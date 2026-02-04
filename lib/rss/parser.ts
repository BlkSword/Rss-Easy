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
        feed: ['language', 'lastBuildDate'],
        item: ['author', 'guid'],
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
          (feed.items || []).map(async (item) => {
            let content = item['content:encoded'] || item.content || item.contentSnippet;

            // 如果没有内容，尝试从链接抓取
            if (!content && item.link) {
              content = await this.fetchContent(item.link);
            }

            // 清理HTML标签，获取纯文本摘要
            const contentSnippet = this.extractSnippet(content || '');

            return {
              title: item.title || 'Untitled',
              link: item.link || '',
              pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
              content: content || undefined,
              contentSnippet,
              author: item.author || item.creator || undefined,
              categories: item.categories || [],
              guid: item.guid,
              isoDate: item.isoDate,
            } as ParsedEntry;
          })
        );

        return {
          title: feed.title || 'Untitled Feed',
          description: feed.description,
          link: feed.link,
          language: feed.language,
          lastBuildDate: feed.lastBuildDate ? new Date(feed.lastBuildDate) : undefined,
          items,
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
