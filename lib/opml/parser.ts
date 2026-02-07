/**
 * OPML 解析器
 * 用于解析 OPML 文件并导入订阅源
 */

import { db } from '@/lib/db';
import { parseFeed } from '@/lib/rss/parser';

export interface OPMLOutline {
  text: string;
  title?: string;
  description?: string;
  xmlUrl?: string;
  htmlUrl?: string;
  type?: string;
  outlines?: OPMLOutline[];
}

export interface ParsedOPML {
  title: string;
  outlines: OPMLOutline[];
}

/**
 * 解析 OPML XML 字符串
 */
export function parseOPML(xmlString: string): ParsedOPML {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('Invalid OPML format');
  }

  const title = doc.querySelector('opml > head > title')?.textContent || 'Imported Feeds';
  const bodyOutlines = Array.from(doc.querySelectorAll('opml > body > outline'));

  const outlines = parseOutlines(bodyOutlines);

  return { title, outlines };
}

/**
 * 递归解析 outline 元素
 */
function parseOutlines(elements: Element[]): OPMLOutline[] {
  return elements.map((el) => {
    const outline: OPMLOutline = {
      text: el.getAttribute('text') || '',
    };

    if (el.hasAttribute('title')) {
      outline.title = el.getAttribute('title')!;
    }
    if (el.hasAttribute('description')) {
      outline.description = el.getAttribute('description')!;
    }
    if (el.hasAttribute('xmlUrl')) {
      outline.xmlUrl = el.getAttribute('xmlUrl')!;
    }
    if (el.hasAttribute('htmlUrl')) {
      outline.htmlUrl = el.getAttribute('htmlUrl')!;
    }
    if (el.hasAttribute('type')) {
      outline.type = el.getAttribute('type')!;
    }

    const childOutlines = el.children;
    if (childOutlines.length > 0) {
      outline.outlines = parseOutlines(Array.from(childOutlines) as Element[]);
    }

    return outline;
  });
}

/**
 * 从 OPML 中提取所有订阅源
 */
export function extractFeedsFromOPML(opml: ParsedOPML): Array<{
  title: string;
  text: string;
  feedUrl: string;
  siteUrl?: string;
  description?: string;
}> {
  const feeds: Array<{
    title: string;
    text: string;
    feedUrl: string;
    siteUrl?: string;
    description?: string;
  }> = [];

  function traverseOutlines(outlines: OPMLOutline[]) {
    for (const outline of outlines) {
      if (outline.xmlUrl && (outline.type === 'rss' || !outline.type)) {
        feeds.push({
          title: outline.title || outline.text,
          text: outline.text,
          feedUrl: outline.xmlUrl,
          siteUrl: outline.htmlUrl,
          description: outline.description,
        });
      }

      if (outline.outlines) {
        traverseOutlines(outline.outlines);
      }
    }
  }

  traverseOutlines(opml.outlines);
  return feeds;
}

/**
 * 导入 OPML 到数据库
 */
export async function importOPML(
  userId: string,
  xmlString: string,
  options?: {
    categoryId?: string;
    validateOnly?: boolean;
  }
): Promise<{
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}> {
  try {
    const opml = parseOPML(xmlString);
    const feeds = extractFeedsFromOPML(opml);

    const result = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (options?.validateOnly) {
      return { ...result, imported: feeds.length };
    }

    for (const feed of feeds) {
      try {
        // 验证 feed URL
        const parsed = await parseFeed(feed.feedUrl);

        // 检查是否已存在
        const existing = await db.feed.findFirst({
          where: {
            userId,
            feedUrl: feed.feedUrl,
          },
        });

        if (existing) {
          result.errors.push(`Feed already exists: ${feed.title}`);
          result.failed++;
          continue;
        }

        // 优先使用 OPML 中的标题和描述
        // OPML 中的 text 是主要的显示文本，应该作为首选标题
        const title = feed.title || feed.text || parsed.title;
        const description = feed.description || parsed.description;

        // 创建 feed
        await db.feed.create({
          data: {
            userId,
            categoryId: options?.categoryId || null,
            title,
            description,
            feedUrl: feed.feedUrl,
            siteUrl: feed.siteUrl || parsed.link,
            fetchInterval: 3600,
            priority: 5,
            isActive: true,
          },
        });

        result.imported++;
      } catch (error) {
        result.errors.push(`Failed to import ${feed.title}: ${String(error)}`);
        result.failed++;
      }
    }

    return result;
  } catch (error) {
    throw new Error(`OPML import failed: ${String(error)}`);
  }
}
