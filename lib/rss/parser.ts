/**
 * RSS解析器
 * 支持RSS、Atom、JSON Feed等格式
 */

import Parser from 'rss-parser';
import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import axios, { type AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { retry, sleep } from '../utils';

/**
 * 浏览器请求头配置 - 模拟真实浏览器访问
 * 用于绕过反爬虫保护
 */
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'connection': 'keep-alive',
};

/**
 * 获取代理 Agent
 * 支持环境变量 HTTP_PROXY, HTTPS_PROXY, NO_PROXY
 * 以及自动检测本地代理（Clash、V2Ray 等）
 */
function getProxyAgent(url: string): { httpsAgent?: HttpsProxyAgent | SocksProxyAgent } | {} {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  // 检查 NO_PROXY
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (noProxy) {
    const noProxyList = noProxy.split(',').map(s => s.trim());
    if (noProxyList.some(pattern => hostname === pattern || hostname.endsWith('.' + pattern))) {
      return {};
    }
  }

  // 1. 检查环境变量中的代理 URL
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
                   process.env.HTTP_PROXY || process.env.http_proxy;

  if (proxyUrl) {
    try {
      // SOCKS 代理
      if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks4://')) {
        return { httpsAgent: new SocksProxyAgent(proxyUrl) };
      }
      // HTTP/HTTPS 代理
      return { httpsAgent: new HttpsProxyAgent(proxyUrl) };
    } catch {
      // 忽略解析错误
    }
  }

  // 2. 自动检测本地代理（开发环境或显式启用）
  if (process.env.RSS_AUTO_PROXY === 'true' || process.env.NODE_ENV === 'development') {
    const proxyPort = process.env.RSS_PROXY_PORT ? parseInt(process.env.RSS_PROXY_PORT) : 7890;
    const proxyHost = process.env.RSS_PROXY_HOST || '127.0.0.1';

    try {
      return { httpsAgent: new HttpsProxyAgent(`http://${proxyHost}:${proxyPort}`) };
    } catch {
      // 忽略错误
    }
  }

  return {};
}

export type ParsedFeed = {
  title: string;
  description?: string;
  link?: string;
  language?: string;
  lastBuildDate?: Date;
  items: ParsedEntry[];
  // 增强字段
  image?: {
    url?: string;
    title?: string;
    link?: string;
  };
  icon?: string;
  managingEditor?: string;
  webMaster?: string;
  pubDate?: Date;
};

export type ParsedEntry = {
  title: string;
  link: string;
  pubDate?: Date;
  content?: string;
  contentSnippet?: string;
  author?: string;
  categories?: string[];
  guid?: string;
  isoDate?: string;
  // 增强字段
  creator?: string;
  description?: string;
  summary?: string;
  updatedDate?: Date;
  publishedDate?: Date;
  tags?: string[];
  image?: string;
  enclosure?: {
    url: string;
    type?: string;
    length?: number;
  };
  // 从内容提取的元数据
  source?: string;
  extractedDate?: string;
  // 原始数据，用于调试
  raw?: any;
};

/**
 * 并发控制 - 限制同时执行的 Promise 数量
 */
async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
      const index = executing.indexOf(promise);
      if (index > -1) executing.splice(index, 1);
    });
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * 规范化 author 字段为字符串
 * 处理 Atom feed 中复杂的 author 对象结构
 */
function normalizeAuthor(author: unknown): string | undefined {
  if (!author) return undefined;

  // 已经是字符串
  if (typeof author === 'string') {
    return author.trim() || undefined;
  }

  // 处理对象结构（Atom feed 格式）
  if (typeof author === 'object') {
    const authObj = author as Record<string, unknown>;

    // 提取 name 字段
    if (authObj.name) {
      if (Array.isArray(authObj.name)) {
        // name 可能是数组
        const name = authObj.name.find(n => typeof n === 'string' && n.trim());
        if (name) return String(name).trim();
      } else if (typeof authObj.name === 'string') {
        return authObj.name.trim() || undefined;
      }
    }

    // 尝试其他常见字段
    if (typeof authObj.email === 'string') {
      return authObj.email.trim() || undefined;
    }

    // 最后尝试 JSON 序列化（不太理想但比报错好）
    try {
      const jsonStr = JSON.stringify(author);
      // 如果太长就截断
      return jsonStr.length > 200 ? jsonStr.slice(0, 200) + '...' : jsonStr;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * RSS解析器类
 */
export class RSSParser {
  private parser: Parser;
  private timeout: number;
  /** 内容长度阈值，少于此值时尝试从链接抓取全文 */
  private readonly MIN_CONTENT_LENGTH = 500;
  /** 全文抓取的最大并发数 */
  private readonly MAX_CONCURRENT_FETCHES = 3;
  /** 单个条目全文抓取超时时间 */
  private readonly FETCH_CONTENT_TIMEOUT = 15000;
  /** 最多对多少个条目尝试全文抓取 */
  private readonly MAX_FULL_TEXT_FETCHES = 10;
  /** RSS Feed 抓取超时时间 */
  private readonly FEED_FETCH_TIMEOUT = 30000;

  constructor(timeout: number = 30000) {
    this.timeout = timeout;
    this.parser = new Parser({
      timeout: this.timeout,
      customFields: {
        feed: [
          'language',
          'lastBuildDate',
          'managingEditor',
          'webMaster',
          'image',
          'icon',
        ],
        item: [
          // 标准 RSS/Atom 字段
          'author',
          'creator',
          'guid',
          'description',
          'summary',
          'published',
          'updated',
          'created',
          'modified',
          'expirationDate',
          // 内容字段 - 多种可能的命名空间
          'content:encoded',
          'content',
          'content:html',
          // Media RSS 字段
          'media:content',
          'media:thumbnail',
          'media:group',
          'media:title',
          'media:description',
          'media:credit',
          'enclosure',
          'enclosures',
          // 其他扩展字段
          'category',
          'categories',
          'tags',
          'dc:creator',
          'dc:date',
          'dc:subject',
          'dc:author',
          'wfw:commentRss',
          'comments',
          'slash:comments',
          'feedburner:origLink',
          // 微信公众号特有
          'mp:author',
          'mp:source',
          // 通用来源字段
          'source',
        ],
      },
    });
  }

  /**
   * 使用浏览器请求头获取 RSS Feed 内容
   * 解决反爬虫保护问题
   */
  private async fetchFeedContent(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FEED_FETCH_TIMEOUT);

    try {
      // 获取代理配置
      const proxyAgent = getProxyAgent(url);

      const response = await axios.get(url, {
        timeout: this.FEED_FETCH_TIMEOUT,
        maxRedirects: 5,
        signal: controller.signal,
        headers: {
          ...BROWSER_HEADERS,
          'host': new URL(url).hostname,
        },
        responseType: 'arraybuffer',
        maxContentLength: 50 * 1024 * 1024, // 50MB
        ...proxyAgent,
      });

      clearTimeout(timeoutId);

      // 检测并解码响应内容
      const contentType = response.headers['content-type'] || '';
      let content: string;

      // 处理可能的编码
      if (response.data instanceof ArrayBuffer) {
        const buffer = Buffer.from(response.data);

        // 尝试从 content-type 检测编码
        const charsetMatch = contentType.match(/charset=([^;]+)/i);
        const charset = charsetMatch ? charsetMatch[1].trim().toLowerCase() : 'utf-8';

        if (charset === 'utf-8' || charset === 'utf8') {
          content = buffer.toString('utf-8');
        } else if (charset === 'gbk' || charset === 'gb2312' || charset === 'gb18030') {
          // GBK 编码处理 - 使用 TextDecoder（Node.js 内置）
          try {
            const decoder = new TextDecoder(charset === 'gb2312' ? 'gbk' : charset);
            content = decoder.decode(buffer);
          } catch {
            // 如果解码失败，尝试 UTF-8
            content = buffer.toString('utf-8');
          }
        } else {
          content = buffer.toString('utf-8');
        }
      } else {
        content = response.data;
      }

      return content;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // 提供更详细的错误信息，包含解决建议
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw new Error(`RSS Feed 抓取超时: ${url}。可能原因：1) 服务器响应慢 2) 需要代理访问 3) 有反爬虫保护。建议设置 HTTPS_PROXY 环境变量使用代理。`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(`域名解析失败: ${url}`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`连接被拒绝: ${url}`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH') {
        throw new Error(`网络连接超时或不可达: ${url}。建议设置 HTTPS_PROXY 环境变量使用代理访问。`);
      } else if (error.response) {
        const status = error.response.status;
        if (status === 403) {
          throw new Error(`访问被拒绝 (403): ${url}。该网站可能有反爬虫保护。建议：1) 设置 HTTPS_PROXY 环境变量使用代理 2) 联系网站管理员添加白名单。`);
        } else if (status === 429) {
          throw new Error(`请求频率过高 (429): ${url}。请稍后重试。`);
        } else if (status === 503) {
          throw new Error(`服务暂时不可用 (503): ${url}。该网站可能正在维护或有 Cloudflare 保护。`);
        }
        throw new Error(`HTTP 错误 ${status}: ${url}`);
      }

      throw error;
    }
  }

  /**
   * 解析RSS/Atom feed
   */
  async parseFeed(url: string): Promise<ParsedFeed> {
    return retry(
      async () => {
        // 使用自定义 fetch 获取内容（带浏览器请求头）
        const feedContent = await this.fetchFeedContent(url);

        // 使用 parseString 解析内容
        const feed = await this.parser.parseString(feedContent);

        // 第一遍：快速处理所有条目，不抓取全文
        const preliminaryItems = (feed.items || []).map((item: any) => {
          // 提取内容 - 按优先级尝试多个字段
          let content = item['content:encoded'] || item.content || item['content:html'] || item.summary || '';
          const description = item.description || '';

          // 如果主要内容为空或太短，使用 description
          if ((!content || content.length < this.MIN_CONTENT_LENGTH) && description) {
            content = description;
          }

          return {
            item,
            content,
            needsFullFetch: !content || this.stripHtml(content).length < this.MIN_CONTENT_LENGTH,
          };
        });

        // 找出需要全文抓取的条目，但限制数量
        const itemsNeedingFetch = preliminaryItems
          .filter(p => p.needsFullFetch && p.item.link)
          .slice(0, this.MAX_FULL_TEXT_FETCHES);

        // 使用并发控制进行全文抓取
        if (itemsNeedingFetch.length > 0) {
          const fetchTasks = itemsNeedingFetch.map(p => async () => {
            try {
              const fetchedContent = await this.fetchContentWithTimeout(p.item.link);
              if (fetchedContent && fetchedContent.length > (p.content?.length || 0)) {
                p.content = fetchedContent;
              }
            } catch {
              // 静默失败
            }
          });

          await limitConcurrency(fetchTasks, this.MAX_CONCURRENT_FETCHES);
        }

        // 第二遍：处理所有条目的元数据
        const items = preliminaryItems.map(({ item, content }) => {
          try {
            // 清理HTML内容中的元数据
            content = this.cleanContentHtml(content || '');

            // 清理HTML标签，获取纯文本摘要
            const contentSnippet = this.extractSnippet(content);

            // 提取作者 - 多个可能的字段
            let author = item.author ||
                        item.creator ||
                        item['dc:creator'] ||
                        item['dc:author'] ||
                        item['mp:author'] ||
                        undefined;

            // 提取分类/标签
            const categories = this.extractCategories(item);

            // 从 HTML 内容中提取元数据（微信等特殊格式）
            const contentMetadata = this.extractMetadataFromContent(content || '');

            // 如果没有从 XML 字段中找到作者，尝试从内容中提取
            if (!author && contentMetadata.author) {
              author = contentMetadata.author;
            }

            // 规范化 author 为字符串
            const normalizedAuthor = normalizeAuthor(author);

            // 提取图片
            const image = this.extractImage(item, content);

            // 提取 enclosure 信息
            const enclosure = this.extractEnclosure(item);

            // 提取各种日期
            const pubDate = this.parseDate(item.pubDate || item.published || item.created || item['dc:date']);
            const updatedDate = this.parseDate(item.updated || item.modified);

            return {
              title: (item.title || 'Untitled').trim(),
              link: item.link || item['feedburner:origLink'] || (item.guid && item.guid.startsWith('http') ? item.guid : ''),
              pubDate,
              content: content || undefined,
              contentSnippet,
              author: normalizedAuthor,
              categories,
              guid: item.guid || item.id,
              isoDate: item.isoDate,
              creator: item.creator,
              description: item.description,
              summary: item.summary,
              updatedDate,
              publishedDate: pubDate,
              tags: item.tags || categories,
              image,
              enclosure,
              source: contentMetadata.source,
              ...(contentMetadata.date && { extractedDate: contentMetadata.date }),
              raw: process.env.NODE_ENV === 'development' ? item : undefined,
            } as ParsedEntry;
          } catch (error) {
            // 如果单个条目处理失败，返回基本条目
            console.error('Error parsing RSS item:', error);
            const rawItem = item as any;
            const fallbackLink = rawItem.link || (rawItem.guid && rawItem.guid.startsWith('http') ? rawItem.guid : '');
            return {
              title: (rawItem.title || 'Untitled').trim(),
              link: fallbackLink,
              pubDate: (item as any).pubDate ? new Date((item as any).pubDate) : undefined,
              content: (item as any).content || (item as any)['content:encoded'] || undefined,
              contentSnippet: (item as any).contentSnippet || '',
              author: normalizeAuthor((item as any).author || (item as any).creator),
              categories: this.extractCategories(item),
              guid: (item as any).guid,
            } as ParsedEntry;
          }
        });

        return {
          title: (feed.title || 'Untitled Feed').trim(),
          description: feed.description,
          link: feed.link,
          language: feed.language,
          lastBuildDate: feed.lastBuildDate ? new Date(feed.lastBuildDate) : undefined,
          items,
          // 额外的 feed 元数据
          ...(feed.image && {
            image: {
              url: feed.image.url || feed.image.link,
              title: feed.image.title,
              link: feed.image.link,
            },
          }),
          ...(feed.icon && { icon: feed.icon }),
          ...(feed.managingEditor && { managingEditor: feed.managingEditor }),
          ...(feed.webMaster && { webMaster: feed.webMaster }),
          ...(feed.pubDate && { pubDate: new Date(feed.pubDate) }),
        };
      },
      { maxAttempts: 3, delay: 1000 }
    );
  }

  /**
   * 带超时控制的全文抓取
   * 使用 AbortController 实现更可靠的超时控制
   */
  private async fetchContentWithTimeout(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_CONTENT_TIMEOUT);

    try {
      // 获取代理配置
      const proxyAgent = getProxyAgent(url);

      const response = await axios.get(url, {
        timeout: this.FETCH_CONTENT_TIMEOUT,
        maxRedirects: 3,
        signal: controller.signal,
        headers: {
          ...BROWSER_HEADERS,
          'host': new URL(url).hostname,
        },
        // 限制响应大小（10MB）
        maxContentLength: 10 * 1024 * 1024,
        ...proxyAgent,
      });

      clearTimeout(timeoutId);

      const html = response.data;
      if (!html || typeof html !== 'string') {
        return null;
      }

      const $ = load(html);
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');

      this.removeUnwantedElements($);

      // 尝试各种提取方法
      const siteSpecificResult = this.extractBySiteSpecific($, hostname);
      if (siteSpecificResult) return siteSpecificResult;

      const generalResult = this.extractByGeneralSelectors($);
      if (generalResult) return generalResult;

      const densityResult = this.extractByDensityAnalysis($);
      if (densityResult) return densityResult;

      return this.extractFallback($);
    } catch (error: any) {
      clearTimeout(timeoutId);
      // 超时或网络错误，静默返回 null
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.warn(`[RSS] 全文抓取超时: ${url}`);
      }
      return null;
    }
  }

  /**
   * 从网页抓取内容（fallback）
   * 用于 RSS 只有简短摘要时获取全文
   * 支持多种网站的内容提取
   */
  private async fetchContent(url: string): Promise<string | null> {
    try {
      // 获取代理配置
      const proxyAgent = getProxyAgent(url);

      const response = await axios.get(url, {
        timeout: this.FETCH_CONTENT_TIMEOUT,
        maxRedirects: 3,
        headers: {
          ...BROWSER_HEADERS,
          'host': new URL(url).hostname,
        },
        ...proxyAgent,
      });

      const html = response.data;
      const $ = load(html);

      // 解析 URL 获取域名，用于站点特定选择器
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');

      // 移除不需要的元素
      this.removeUnwantedElements($);

      // 站点特定选择器（高优先级）
      const siteSpecificResult = this.extractBySiteSpecific($, hostname);
      if (siteSpecificResult) {
        return siteSpecificResult;
      }

      // 通用选择器提取
      const generalResult = this.extractByGeneralSelectors($);
      if (generalResult) {
        return generalResult;
      }

      // 文本密度分析提取（类似 Readability）
      const densityResult = this.extractByDensityAnalysis($);
      if (densityResult) {
        return densityResult;
      }

      // 最终 fallback
      return this.extractFallback($);
    } catch (error) {
      // 记录错误但不抛出，返回 null 让调用者使用现有内容
      return null;
    }
  }

  /**
   * 移除不需要的 HTML 元素
   */
  private removeUnwantedElements($: CheerioAPI): void {
    // 移除脚本和样式
    $('script, style, noscript, iframe, embed, object').remove();

    // 移除导航和页脚
    $('nav, header, footer, aside').remove();

    // 移除广告相关
    $('[class*="ad-"], [class*="ads-"], [class*="advert"], [id*="ad-"], [id*="ads-"]')
      .filter((_, el) => !$(el).hasClass('article') && !$(el).hasClass('content'))
      .remove();

    // 移除社交分享
    $('[class*="share"], [class*="social"], [class*="comment"]')
      .not('[class*="article"]')
      .not('[class*="content"]')
      .remove();

    // 移除侧边栏
    $('.sidebar, .widget, .related, .recommend, .hot-posts, .popular').remove();

    // 移除隐藏元素
    $('[style*="display: none"], [style*="display:none"], [hidden]').remove();
  }

  /**
   * 站点特定内容提取
   */
  private extractBySiteSpecific($: CheerioAPI, hostname: string): string | null {
    // 站点特定选择器映射
    const siteSelectors: Record<string, string[]> = {
      // 量子位
      'qbitai.com': [
        '.single-content',
        '.article-content',
        '.post-content',
        'article .content',
        '.entry-content',
      ],
      // 36氪
      '36kr.com': [
        '.article-content',
        '.detail-content',
        '.post-content',
        'article',
      ],
      // 虎嗅
      'huxiu.com': [
        '.article-content',
        '.article-content__body',
        '.post-content',
      ],
      // 少数派
      'sspai.com': [
        '.article-content',
        '.post-content',
        '#article-content',
      ],
      // 知乎专栏
      'zhuanlan.zhihu.com': [
        '.Post-RichText',
        '.RichText',
        'article',
      ],
      // 掘金
      'juejin.cn': [
        '.article-content',
        '.markdown-body',
        'article',
      ],
      // InfoQ
      'infoq.cn': [
        '.article-content',
        '.post-content',
        'article',
      ],
      // 机器之心
      'jiqizhixin.com': [
        '.article-content',
        '.post-content',
        'article',
      ],
      // 新智元
      'aismart.org': [
        '.article-content',
        '.post-content',
      ],
      // 博客园
      'cnblogs.com': [
        '#cnblogs_post_body',
        '.postBody',
        '.blogpost-body',
      ],
      // CSDN
      'csdn.net': [
        '#article_content',
        '.article-content',
        '#content_views',
      ],
      // 微信公众号（部分代理站点）
      'mp.weixin.qq.com': [
        '#js_content',
        '.rich_media_content',
      ],
      // 微信转RSS代理
      'wechat2rss.bestblogs.dev': [
        '.content',
      ],
    };

    const selectors = siteSelectors[hostname];
    if (!selectors) return null;

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 200) {
          // 清理内部的不需要的元素
          element.find('script, style, .ad, .ads, .share, .related').remove();
          return element.html() || null;
        }
      }
    }

    return null;
  }

  /**
   * 通用选择器内容提取
   */
  private extractByGeneralSelectors($: CheerioAPI): string | null {
    const selectors = [
      // HTML5 语义化标签
      'article',
      '[role="main"]',
      '[role="article"]',
      'main',
      // WordPress 常用
      '.post-content',
      '.entry-content',
      '.article-content',
      '.single-content',
      '.post-body',
      '.content-body',
      // 常见类名
      '.content',
      '#content',
      '.article-body',
      '.news-content',
      '.detail-content',
      '.post',
      '.article',
      // 通用匹配
      '[class*="article-content"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      '[class*="article-body"]',
      '[id*="article-content"]',
      '[id*="post-content"]',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      // 可能有多个匹配，选择文本最多的那个
      let bestElement: Cheerio<any> | null = null;
      let maxLength = 0;

      elements.each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        if (text.length > maxLength) {
          maxLength = text.length;
          bestElement = $el;
        }
      });

      if (bestElement && maxLength > 200) {
        // 清理内部的不需要的元素
        (bestElement as any).find('script, style, .ad, .ads, .share, .related, .sidebar, nav, aside').remove();
        return (bestElement as any).html() || null;
      }
    }

    return null;
  }

  /**
   * 基于文本密度分析的内容提取（简化版 Readability）
   */
  private extractByDensityAnalysis($: CheerioAPI): string | null {
    // 候选元素标签
    const candidateTags = ['div', 'section', 'article', 'main'];
    let bestCandidate: Cheerio<any> | null = null;
    let bestScore = 0;

    candidateTags.forEach(tag => {
      $(tag).each((_, el) => {
        const $el = $(el);

        // 跳过太小或太大的元素
        const text = $el.text().trim();
        if (text.length < 200) return;

        // 计算文本密度得分
        const score = this.calculateContentScore($, $el);

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = $el;
        }
      });
    });

    if (bestCandidate && bestScore > 10) {
      // 清理内容
      (bestCandidate as any).find('script, style, .ad, .ads, .share, .related, .sidebar, nav, aside, footer').remove();
      const html = (bestCandidate as any).html();
      if (html && this.stripHtml(html).length > 200) {
        return html;
      }
    }

    return null;
  }

  /**
   * 计算元素的内容得分
   */
  private calculateContentScore($: CheerioAPI, $el: Cheerio<any>): number {
    const text = $el.text().trim();
    const html = $el.html() || '';

    // 基础得分：文本长度
    let score = Math.min(text.length / 100, 50);

    // 段落数量加分
    const pCount = $el.find('p').length;
    score += pCount * 2;

    // 链接密度惩罚（链接文字占比过高则减分）
    const linkText = $el.find('a').text().trim();
    const linkDensity = text.length > 0 ? linkText.length / text.length : 0;
    if (linkDensity > 0.3) {
      score *= 0.5;
    }

    // 图片数量（适度加分）
    const imgCount = $el.find('img').length;
    score += Math.min(imgCount, 10);

    // 正面关键词加分
    const positivePatterns = /article|content|post|entry|body|text|main/i;
    const className = $el.attr('class') || '';
    const id = $el.attr('id') || '';
    if (positivePatterns.test(className) || positivePatterns.test(id)) {
      score *= 1.5;
    }

    // 负面关键词减分
    const negativePatterns = /sidebar|widget|footer|header|nav|menu|comment|share|related|ad|banner/i;
    if (negativePatterns.test(className) || negativePatterns.test(id)) {
      score *= 0.2;
    }

    // 逗号句号密度（中文内容特征）
    const punctuationCount = (text.match(/[，。！？、；：]/g) || []).length;
    score += punctuationCount * 0.5;

    return score;
  }

  /**
   * 最终 fallback - 尝试从 body 提取
   */
  private extractFallback($: CheerioAPI): string | null {
    const $body = $('body').clone();

    // 移除所有不需要的元素
    $body.find([
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer', 'aside',
      '.sidebar', '.widget', '.ad', '.ads',
      '.share', '.social', '.comment', '.related',
      '.header', '.footer', '.navigation', '.menu',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    ].join(', ')).remove();

    const text = $body.text().trim();
    if (text.length > 200) {
      return $body.html() || null;
    }

    return null;
  }

  /**
   * 清理HTML内容中的元数据（微信公众号等）
   */
  private cleanContentHtml(html: string): string {
    if (!html) return html;

    const $ = load(html);

    // 1. 移除开头的作者/日期/地点信息
    // 通常格式：<p><span>作者</span> <span>日期</span> <span>地点</span></p>
    const firstP = $('p').first();
    const spans = firstP.find('span');
    if (spans.length >= 2) {
      const spanTexts = spans.map((_, el) => $(el).text()).get();
      // 检查是否匹配作者+日期+地点模式
      const hasDate = spanTexts.some(t => /\d{4}-\d{2}-\d{2}/.test(t));
      const hasShortText = spanTexts.some(t => t.length <= 10 && !t.includes('。'));
      if (hasDate || hasShortText) {
        firstP.remove();
      }
    }

    // 2. 移除"以下文章来源于"相关的段落和后续元素
    let shouldRemove = false;
    $('p, strong').each((_, el) => {
      const text = $(el).text().trim();

      if (text.includes('以下文章来源于')) {
        $(el).remove();
        shouldRemove = true;
        return;
      }

      // 移除来源信息后的公众号名（strong）和简介（p）
      if (shouldRemove) {
        const isAccountName = el.tagName === 'strong' && text.length < 30;
        const isIntro = el.tagName === 'p' && (
          /^专注.{2,10}/.test(text) ||
          /^提供.{2,20}/.test(text) ||
          /^聚焦.{2,15}/.test(text) ||
          /^关注.{2,20}/.test(text) ||
          /^人人产品经理/.test(text) ||
          text.length < 50  // 简短的介绍
        );

        if (isAccountName || isIntro) {
          $(el).remove();
        } else {
          // 遇到正文内容，停止移除
          shouldRemove = false;
        }
      }
    });

    // 3. 移除多余的空段落
    $('p').filter((_, el) => {
      return $(el).text().trim() === '' || $(el).find('img').length === 0 && $(el).text().trim().length < 5;
    }).remove();

    return $.html() || html;
  }

  /**
   * 从HTML内容中提取纯文本摘要
   * 会自动清理微信公众号等来源的元数据
   */
  private extractSnippet(html: string, maxLength: number = 500): string {
    const $ = load(html);

    // 清理微信公众号等特殊格式的元数据元素
    // 1. 移除开头的作者/日期/地点信息（通常是第一个 p 标签中的 span）
    $('p').first().find('span').remove();

    // 2. 移除"以下文章来源于"相关的段落
    $('p').filter((_, el) => {
      const text = $(el).text();
      return text.includes('以下文章来源于') || text.includes('以下文章来源于：');
    }).remove();

    // 3. 移除紧跟在"以下文章来源于"后面的 strong 标签（公众号名）
    $('strong').filter((_, el) => {
      const text = $(el).text().trim();
      // 检查是否是公众号名（通常较短且不包含特殊字符）
      return text.length < 30 && !text.includes('】') && !text.includes('推荐阅读');
    }).remove();

    // 4. 移除公众号简介段落（通常是单独的一句话描述）
    $('p').filter((_, el) => {
      const text = $(el).text().trim();
      // 匹配常见的公众号简介模式
      const introPatterns = [
        /^专注.{2,10}(研究|分享|领域)/,
        /^提供.{2,20}(信息|参考|服务)/,
        /^聚焦.{2,15}(科技|前沿|行业)/,
        /^人人产品经理/,
        /^关注.{2,20}(技术|成长|领域)/,
        /^AI[、，].*追踪/,
        /^做有思想/,
        /^百万成神/,
        /^合作请联系/,
      ];
      return introPatterns.some(p => p.test(text));
    }).remove();

    const text = $.text().trim();

    // 清理文本中的元数据模式
    let cleanedText = text
      // 移除开头的日期时间模式（如 "2026-02-13 07:46"）
      .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s*/gm, '')
      // 移除"以下文章来源于：xxx"及其后续内容（直到遇到正文）
      .replace(/以下文章来源于[：:][^\n]*/g, '')
      // 移除地名开头（如 "重庆" 单独一行）
      .replace(/^[北上广深重成杭西武南京苏][京海州庆都州安汉京林州]\s*/gm, '')
      // 移除多余空白
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // 再次清理开头可能残留的作者名（中文2-4字 + 空格 + 日期）
    cleanedText = cleanedText.replace(/^[\u4e00-\u9fa5]{2,4}\s+\d{4}-\d{2}-\d{2}/, '');

    // 清理开头的空白
    cleanedText = cleanedText.trim();

    if (cleanedText.length <= maxLength) {
      return cleanedText;
    }

    // 在句子边界截断
    const truncated = cleanedText.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('。');
    const lastDot = truncated.lastIndexOf('.');
    const lastSentence = Math.max(lastPeriod, lastDot);

    if (lastSentence > maxLength * 0.7) {
      return truncated.slice(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  /**
   * 移除HTML标签，返回纯文本
   */
  private stripHtml(html: string): string {
    if (!html) return '';
    const $ = load(html);
    return $.text().trim();
  }

  /**
   * 从 HTML 内容中提取元数据（如作者、来源等）
   * 专门处理微信公众号等富文本内容
   */
  private extractMetadataFromContent(content: string): { author?: string; source?: string; date?: string } {
    const metadata: { author?: string; source?: string; date?: string } = {};
    const $ = load(content);

    // 提取作者 - 微信公众号常见格式
    // 格式1: <span>作者名</span> <span>日期</span> <span>地点</span>
    const firstPSpans = $('p').first().find('span');
    if (firstPSpans.length >= 1) {
      const firstSpan = $(firstPSpans[0]).text().trim();
      // 检查是否是作者名（通常不是日期格式）
      if (!firstSpan.match(/^\d{4}-\d{2}-\d{2}/) && !firstSpan.match(/^\d+:\d{2}/)) {
        metadata.author = firstSpan;
      }
    }

    // 格式2: 查找"原创"标识后的作者
    const originalSpan = $('p').filter((i, el) => {
      const text = $(el).text();
      return text.includes('原创') || text.includes('作者');
    });
    if (originalSpan.length > 0) {
      const text = originalSpan.first().text();
      const authorMatch = text.match(/(?:原创|作者)[：:]\s*([^\s]+)/);
      if (authorMatch && authorMatch[1]) {
        metadata.author = authorMatch[1];
      }
    }

    // 格式3: 查找来源信息
    const sourceText = $('body').text();
    const sourceMatch = sourceText.match(/以下文章来源于[：:]\s*([^\n]+)/);
    if (sourceMatch && sourceMatch[1]) {
      metadata.source = sourceMatch[1].trim();
    }

    // 格式4: 查找 <strong> 标签作为来源（微信常见）
    const strongTag = $('strong').first();
    if (strongTag.length > 0) {
      const strongText = strongTag.text().trim();
      if (strongText && !strongText.includes('AI') && strongText.length < 50) {
        metadata.source = strongText;
      }
    }

    // 提取日期 - 各种格式
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/,
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      /(\d{1,2})月(\d{1,2})日/,
    ];

    for (const pattern of datePatterns) {
      const match = sourceText.match(pattern);
      if (match) {
        metadata.date = match[0];
        break;
      }
    }

    return metadata;
  }

  /**
   * 提取分类/标签
   */
  private extractCategories(item: any): string[] {
    const categories: string[] = [];

    // 处理 category 数组（每个可能是字符串或对象）
    if (Array.isArray(item.categories)) {
      item.categories.forEach((cat: any) => {
        if (typeof cat === 'string') {
          categories.push(cat);
        } else if (cat && typeof cat === 'object') {
          if (cat._) categories.push(cat._);
          if (cat.$) categories.push(cat.$);
          if (cat.name) categories.push(cat.name);
          if (cat.term) categories.push(cat.term);
        }
      });
    }

    // 处理单个 category
    if (item.category) {
      if (Array.isArray(item.category)) {
        item.category.forEach((cat: any) => {
          if (typeof cat === 'string') categories.push(cat);
          else if (cat && (cat._ || cat.name || cat.term)) {
            categories.push(cat._ || cat.name || cat.term);
          }
        });
      } else if (typeof item.category === 'string') {
        categories.push(item.category);
      } else if (item.category._ || item.category.name) {
        categories.push(item.category._ || item.category.name);
      }
    }

    // 处理 tags
    if (Array.isArray(item.tags)) {
      categories.push(...item.tags.filter((t: any) => typeof t === 'string'));
    }

    // 处理 dc:subject
    if (item['dc:subject']) {
      if (Array.isArray(item['dc:subject'])) {
        categories.push(...item['dc:subject']);
      } else {
        categories.push(item['dc:subject']);
      }
    }

    return Array.from(new Set(categories)).filter(Boolean); // 去重并过滤空值
  }

  /**
   * 提取图片 URL
   * 支持 Media RSS、enclosure 和从 HTML 内容中提取
   */
  private extractImage(item: any, content: string): string | undefined {
    // 1. 检查 media:thumbnail
    if (item['media:thumbnail']) {
      const thumbnail = item['media:thumbnail'];
      // 可能是对象格式 { $: { url: '...' } }
      if (thumbnail['$']?.url) {
        return thumbnail['$'].url;
      }
      // 可能是数组格式
      if (Array.isArray(thumbnail)) {
        const firstThumb = thumbnail.find((t: any) => t['$']?.url);
        if (firstThumb) return firstThumb['$'].url;
      }
    }

    // 2. 检查 media:content
    if (item['media:content']) {
      const mediaContent = item['media:content'];
      // 数组格式：找到第一个图片类型的媒体
      if (Array.isArray(mediaContent)) {
        // 优先找图片类型
        const imageMedia = mediaContent.find((m: any) => {
          const type = m['$']?.type || m['$']?.medium;
          return this.isImageMimeType(type) || type === 'image';
        });
        if (imageMedia?.['$']?.url) {
          return imageMedia['$'].url;
        }
        // 没找到图片类型，用第一个有URL的
        const firstMedia = mediaContent.find((m: any) => m['$']?.url);
        if (firstMedia) return firstMedia['$'].url;
      } else if (mediaContent['$']?.url) {
        return mediaContent['$'].url;
      }
    }

    // 3. 检查 media:group 中的内容
    if (item['media:group']) {
      const group = item['media:group'];
      // 检查 group 中的 thumbnail
      if (group['media:thumbnail']?.['$']?.url) {
        return group['media:thumbnail']['$'].url;
      }
      // 检查 group 中的 content
      if (Array.isArray(group['media:content'])) {
        const firstImage = group['media:content'].find((m: any) => m['$']?.url);
        if (firstImage) return firstImage['$'].url;
      }
      if (group['media:content']?.['$']?.url) {
        return group['media:content']['$'].url;
      }
    }

    // 4. 检查 enclosure（如果是图片）
    if (item.enclosure?.url && this.isImageMimeType(item.enclosure.type)) {
      return item.enclosure.url;
    }

    // 5. 从内容中提取第一张图片
    if (content) {
      const imageUrl = this.extractFirstImage(content, item.link);
      if (imageUrl) return imageUrl;
    }

    return undefined;
  }

  /**
   * 从 HTML 内容中提取第一张图片
   */
  private extractFirstImage(html: string, baseUrl?: string): string | undefined {
    try {
      const $ = load(html);
      const firstImg = $('img').first();
      if (firstImg.length > 0) {
        let src = firstImg.attr('src') || firstImg.attr('data-src');
        if (src) {
          // 处理各种相对路径
          src = this.resolveUrl(src, baseUrl);
          return src;
        }
      }
    } catch {
      // 忽略解析错误
    }
    return undefined;
  }

  /**
   * 解析相对 URL 为绝对 URL
   */
  private resolveUrl(url: string, baseUrl?: string): string {
    if (!url) return url;

    // 已经是绝对路径
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // 协议相对路径
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    // 相对路径
    if (baseUrl && url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        return base.origin + url;
      } catch {
        return url;
      }
    }

    return url;
  }

  /**
   * 提取 enclosure 信息
   */
  private extractEnclosure(item: any): { url: string; type?: string; length?: number } | undefined {
    const enclosure = item.enclosure || item.enclosures?.[0];

    if (!enclosure) return undefined;

    if (typeof enclosure === 'string') {
      return { url: enclosure };
    }

    if (enclosure.url) {
      return {
        url: enclosure.url,
        type: enclosure.type || enclosure.mimeType,
        length: enclosure.length || parseInt(enclosure.length || '0'),
      };
    }

    return undefined;
  }

  /**
   * 解析日期
   */
  private parseDate(dateStr: any): Date | undefined {
    if (!dateStr) return undefined;

    try {
      if (dateStr instanceof Date) {
        return dateStr;
      }

      if (typeof dateStr === 'string') {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    } catch {
      // 忽略解析错误
    }

    return undefined;
  }

  /**
   * 判断是否为图片 MIME 类型
   */
  private isImageMimeType(mimeType?: string): boolean {
    if (!mimeType) return false;
    return mimeType.startsWith('image/');
  }

  /**
   * 验证feed URL是否有效
   */
  async validateFeedUrl(url: string): Promise<boolean> {
    try {
      const feedContent = await this.fetchFeedContent(url);
      await this.parser.parseString(feedContent);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从HTML页面发现RSS feeds
   */
  async discoverFeeds(url: string): Promise<string[]> {
    const feeds: string[] = [];

    try {
      // 获取代理配置
      const proxyAgent = getProxyAgent(url);

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          ...BROWSER_HEADERS,
          'host': new URL(url).hostname,
        },
        ...proxyAgent,
      });

      const $ = load(response.data);

      // 查找link标签中的RSS feeds
      $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each(
        (_i, element) => {
          const href = $(element).attr('href');
          if (href) {
            // 转换为绝对URL
            feeds.push(this.resolveUrl(href, url));
          }
        }
      );

      // 查找<a>标签中的RSS links
      $('a[href*="rss"], a[href*="feed"], a[href*="atom"]').each((_i, element) => {
        const href = $(element).attr('href');
        if (href && (href.includes('rss') || href.includes('feed') || href.includes('atom'))) {
          feeds.push(this.resolveUrl(href, url));
        }
      });

      // 查找 JSON Feed
      $('link[type="application/json"], link[type="application/feed+json"]').each(
        (_i, element) => {
          const href = $(element).attr('href');
          if (href) {
            feeds.push(this.resolveUrl(href, url));
          }
        }
      );
    } catch {
      // 忽略错误
    }

    // 去重
    return Array.from(new Set(feeds));
  }
}

// 单例导出
export const rssParser = new RSSParser();

/**
 * 便捷函数：解析feed
 */
export async function parseFeed(url: string): Promise<ParsedFeed> {
  return rssParser.parseFeed(url);
}

/**
 * 便捷函数：验证feed URL
 */
export async function validateFeedUrl(url: string): Promise<boolean> {
  return rssParser.validateFeedUrl(url);
}

/**
 * 便捷函数：发现feeds
 */
export async function discoverFeeds(url: string): Promise<string[]> {
  return rssParser.discoverFeeds(url);
}
