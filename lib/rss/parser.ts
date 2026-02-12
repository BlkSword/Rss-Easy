/**
 * RSS解析器
 * 支持RSS、Atom、JSON Feed等格式
 */

import Parser from 'rss-parser';
import { load } from 'cheerio';
import axios from 'axios';
import { retry, sleep } from '../utils';

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
 * RSS解析器类
 */
export class RSSParser {
  private parser: Parser;
  private timeout: number;

  constructor(timeout: number = 10000) {
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
          // 内容字段
          'content:encoded',
          'content',
          // Media RSS 字段
          'media:content',
          'media:thumbnail',
          'media:group',
          'enclosure',
          'enclosures',
          // 其他扩展字段
          'category',
          'categories',
          'tags',
          'dc:creator',
          'dc:date',
          'dc:subject',
          'wfw:commentRss',
          'comments',
          'slash:comments',
          'feedburner:origLink',
        ],
      },
    });
  }

  /**
   * 解析RSS/Atom feed
   */
  async parseFeed(url: string): Promise<ParsedFeed> {
    return retry(
      async () => {
        const feed = await this.parser.parseURL(url);

        // 处理每个条目，提取完整内容
        const items = await Promise.all(
          (feed.items || []).map(async (item: any) => {
            try {
              // 提取内容 - 按优先级尝试多个字段
              let content = item['content:encoded'] || item.content || item['content:html'] || item.summary || item.description || '';

              // 如果没有内容，尝试从链接抓取
              if (!content && item.link) {
                try {
                  content = await this.fetchContent(item.link);
                } catch {
                  // 静默失败，使用空内容
                  content = '';
                }
              }

              // 清理HTML标签，获取纯文本摘要
              const contentSnippet = this.extractSnippet(content || '');

              // 提取作者 - 多个可能的字段
              let author = item.author ||
                          item.creator ||
                          item['dc:creator'] ||
                          undefined;

              // 提取分类/标签
              const categories = this.extractCategories(item);

              // 从 HTML 内容中提取元数据（微信等特殊格式）
              const contentMetadata = this.extractMetadataFromContent(content || '');

              // 如果没有从 XML 字段中找到作者，尝试从内容中提取
              if (!author && contentMetadata.author) {
                author = contentMetadata.author;
              }

              // 提取图片
              const image = this.extractImage(item, content);

              // 提取 enclosure 信息
              const enclosure = this.extractEnclosure(item);

              // 提取各种日期
              const pubDate = this.parseDate(item.pubDate || item.published || item.created || item['dc:date']);
              const updatedDate = this.parseDate(item.updated || item.modified);

              return {
                title: item.title || 'Untitled',
                link: item.link || item['feedburner:origLink'] || '',
                pubDate,
                content: content || undefined,
                contentSnippet,
                author,
                categories,
                guid: item.guid || item.id,
                isoDate: item.isoDate,
                // 新增字段
                creator: item.creator,
                description: item.description,
                summary: item.summary,
                updatedDate,
                publishedDate: pubDate,
                tags: item.tags || categories,
                image,
                enclosure,
                // 从内容中提取的元数据
                source: contentMetadata.source,
                ...(contentMetadata.date && { extractedDate: contentMetadata.date }),
                raw: process.env.NODE_ENV === 'development' ? item : undefined,
              } as ParsedEntry;
            } catch (error) {
              // 如果单个条目处理失败，返回基本条目
              console.error('Error parsing RSS item:', error);
              return {
                title: (item as any).title || 'Untitled',
                link: (item as any).link || '',
                pubDate: (item as any).pubDate ? new Date((item as any).pubDate) : undefined,
                content: (item as any).content || (item as any)['content:encoded'] || undefined,
                contentSnippet: (item as any).contentSnippet || '',
                author: (item as any).author || (item as any).creator || undefined,
                categories: this.extractCategories(item),
                guid: (item as any).guid,
              } as ParsedEntry;
            }
          })
        );

        return {
          title: feed.title || 'Untitled Feed',
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
   * 从网页抓取内容（fallback）
   */
  private async fetchContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Rss-Easy/1.0)',
        },
      });

      const $ = load(response.data);

      // 移除不需要的元素
      $('script, style, nav, footer, header, aside, iframe').remove();

      // 尝试找到主要内容
      const contentSelectors = [
        'article',
        '[role="main"]',
        'main',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
      ];

      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0 && element.text().trim().length > 200) {
          return element.html() || null;
        }
      }

      // fallback到body
      const bodyText = $('body').text().trim();
      if (bodyText.length > 200) {
        return $('body').html() || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 从HTML内容中提取纯文本摘要
   */
  private extractSnippet(html: string, maxLength: number = 500): string {
    const $ = load(html);
    const text = $.text().trim();

    // 移除多余空白
    const cleanedText = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

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

    return [...new Set(categories)].filter(Boolean); // 去重并过滤空值
  }

  /**
   * 提取图片 URL
   */
  private extractImage(item: any, content: string): string | undefined {
    // 1. 检查 media:thumbnail
    if (item['media:thumbnail']?.['$']?.url) {
      return item['media:thumbnail']['$'].url;
    }

    // 2. 检查 media:content
    if (item['media:content']?.['$']?.url) {
      return item['media:content']['$'].url;
    }

    // 3. 检查 media:group 中的内容
    if (item['media:group']) {
      const group = item['media:group'];
      if (Array.isArray(group['media:content'])) {
        const firstImage = group['media:content'].find((m: any) => m['$']?.url);
        if (firstImage) return firstImage['$'].url;
      }
      if (group['media:content']?.['$']?.url) {
        return group['media:content']['$'].url;
      }
      if (group['media:thumbnail']?.['$']?.url) {
        return group['media:thumbnail']['$'].url;
      }
    }

    // 4. 检查 enclosure（如果是图片）
    if (item.enclosure?.url && this.isImageMimeType(item.enclosure.type)) {
      return item.enclosure.url;
    }

    // 5. 从内容中提取第一张图片
    if (content) {
      const $ = load(content);
      const firstImg = $('img').first();
      if (firstImg.length > 0) {
        let src = firstImg.attr('src');
        if (src) {
          // 处理相对路径
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/')) {
            const linkUrl = new URL(item.link || 'https://example.com');
            src = linkUrl.origin + src;
          }
          return src;
        }
      }
    }

    return undefined;
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
      await this.parser.parseURL(url);
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
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Rss-Easy/1.0)',
        },
      });

      const $ = load(response.data);

      // 查找link标签中的RSS feeds
      $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each(
        (_i, element) => {
          const href = $(element).attr('href');
          if (href) {
            feeds.push(href);
          }
        }
      );

      // 查找<a>标签中的RSS links
      $('a[href*="rss"], a[href*="feed"], a[href*="atom"]').each((_i, element) => {
        const href = $(element).attr('href');
        if (href && (href.includes('rss') || href.includes('feed') || href.includes('atom'))) {
          feeds.push(href);
        }
      });
    } catch {
      // 忽略错误
    }

    return feeds;
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
