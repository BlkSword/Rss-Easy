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
 * 获取元素属性，忽略大小写
 * OPML 文件可能使用不同的属性大小写（如 xmlUrl, XMLUrl, xmlurl）
 */
function getAttributeCaseInsensitive(el: Element, attrName: string): string | null {
  // 先尝试精确匹配
  let value = el.getAttribute(attrName);
  if (value) return value;

  // 尝试所有小写
  value = el.getAttribute(attrName.toLowerCase());
  if (value) return value;

  // 尝试首字母大写
  const camelCase = attrName.charAt(0).toUpperCase() + attrName.slice(1);
  value = el.getAttribute(camelCase);
  if (value) return value;

  // 尝试全大写
  value = el.getAttribute(attrName.toUpperCase());
  if (value) return value;

  // 遍历所有属性查找匹配
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    if (attrs[i].name.toLowerCase() === attrName.toLowerCase()) {
      return attrs[i].value;
    }
  }

  return null;
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
      text: getAttributeCaseInsensitive(el, 'text') || '',
    };

    const title = getAttributeCaseInsensitive(el, 'title');
    if (title) outline.title = title;

    const description = getAttributeCaseInsensitive(el, 'description');
    if (description) outline.description = description;

    const xmlUrl = getAttributeCaseInsensitive(el, 'xmlUrl');
    if (xmlUrl) outline.xmlUrl = xmlUrl;

    const htmlUrl = getAttributeCaseInsensitive(el, 'htmlUrl');
    if (htmlUrl) outline.htmlUrl = htmlUrl;

    const type = getAttributeCaseInsensitive(el, 'type');
    if (type) outline.type = type;

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
      // 检查是否有 xmlUrl（RSS feed URL）
      if (outline.xmlUrl) {
        // type 可能是 rss、atom 等，或者为空（默认为 rss）
        const isFeedType = !outline.type ||
          outline.type.toLowerCase() === 'rss' ||
          outline.type.toLowerCase() === 'atom' ||
          outline.type.toLowerCase() === 'feed';

        if (isFeedType) {
          feeds.push({
            // 优先使用 text 作为标题（OPML 标准中 text 是主要的显示文本）
            title: outline.text || outline.title || '',
            text: outline.text,
            feedUrl: outline.xmlUrl,
            siteUrl: outline.htmlUrl,
            description: outline.description,
          });
        }
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
  skipped: number;
  errors: string[];
}> {
  try {
    const opml = parseOPML(xmlString);
    const feeds = extractFeedsFromOPML(opml);

    const result = {
      success: true,
      imported: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    if (options?.validateOnly) {
      return { ...result, imported: feeds.length };
    }

    for (const feed of feeds) {
      try {
        // 检查是否已存在
        const existing = await db.feed.findFirst({
          where: {
            userId,
            feedUrl: feed.feedUrl,
          },
        });

        if (existing) {
          result.errors.push(`Feed already exists: ${feed.title}`);
          result.skipped++;
          continue;
        }

        // 解析 feed 获取详细信息
        let parsed;
        try {
          parsed = await parseFeed(feed.feedUrl);
        } catch {
          // 如果解析失败，使用 OPML 中的信息
          parsed = null;
        }

        // 标题优先级：OPML text > OPML title > 解析出的标题
        const title = feed.text || feed.title || (parsed?.title) || 'Unknown Feed';

        // 描述优先级：OPML description > 解析出的描述
        const description = feed.description || parsed?.description || '';

        // 站点 URL 优先级：OPML htmlUrl > 解析出的 link
        const siteUrl = feed.siteUrl || parsed?.link || '';

        // 创建 feed
        await db.feed.create({
          data: {
            userId,
            categoryId: options?.categoryId || null,
            title,
            description,
            feedUrl: feed.feedUrl,
            siteUrl,
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
