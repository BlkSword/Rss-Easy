/**
 * OPML 解析器
 * 用于解析 OPML 文件（服务端兼容版本）
 *
 * 注意：导入功能已迁移到 importer.ts，提供更完善的智能导入体验
 */

import { XMLParser } from 'fast-xml-parser';

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
 * 获取属性值（忽略大小写）
 */
function getAttr(obj: Record<string, unknown>, attrName: string): string | undefined {
  const lowerName = attrName.toLowerCase();

  // 尝试各种大小写组合
  const keys = [attrName, lowerName, attrName.toUpperCase(), attrName.charAt(0).toUpperCase() + attrName.slice(1)];

  for (const key of keys) {
    if (typeof obj[key] === 'string') {
      return obj[key];
    }
  }

  // 遍历所有属性查找
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lowerName && typeof obj[key] === 'string') {
      return obj[key] as string;
    }
  }

  return undefined;
}

/**
 * 解析 outline 元素
 */
function parseOutlineElement(element: Record<string, unknown>): OPMLOutline | null {
  if (!element || typeof element !== 'object') {
    return null;
  }

  const outline: OPMLOutline = {
    text: getAttr(element, 'text') || getAttr(element, 'title') || '',
  };

  const title = getAttr(element, 'title');
  if (title) outline.title = title;

  const description = getAttr(element, 'description');
  if (description) outline.description = description;

  const xmlUrl = getAttr(element, 'xmlUrl');
  if (xmlUrl) outline.xmlUrl = xmlUrl;

  const htmlUrl = getAttr(element, 'htmlUrl');
  if (htmlUrl) outline.htmlUrl = htmlUrl;

  const type = getAttr(element, 'type');
  if (type) outline.type = type;

  // 递归解析子 outline
  const childOutlines = element.outline;
  if (childOutlines) {
    if (Array.isArray(childOutlines)) {
      outline.outlines = childOutlines
        .map((child) => parseOutlineElement(child as Record<string, unknown>))
        .filter((o): o is OPMLOutline => o !== null);
    } else if (typeof childOutlines === 'object') {
      const parsed = parseOutlineElement(childOutlines as Record<string, unknown>);
      if (parsed) {
        outline.outlines = [parsed];
      }
    }
  }

  return outline;
}

/**
 * 解析 OPML XML 字符串
 */
export function parseOPML(xmlString: string): ParsedOPML {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '#text',
    parseAttributeValue: false,
    trimValues: true,
  });

  let parsed: Record<string, unknown>;

  try {
    parsed = parser.parse(xmlString);
  } catch (error) {
    throw new Error(`Invalid OPML format: ${error instanceof Error ? error.message : 'Parse failed'}`);
  }

  // 获取 opml 根节点
  const opml = parsed.opml;
  if (!opml || typeof opml !== 'object') {
    throw new Error('Invalid OPML format: missing opml root element');
  }

  // 获取标题
  const opmlObj = opml as Record<string, unknown>;
  const head = opmlObj.head as Record<string, unknown> | undefined;
  const title = (head && typeof head.title === 'string' ? head.title : null) || 'Imported Feeds';

  // 获取 body 中的 outline
  const body = opmlObj.body as Record<string, unknown> | undefined;
  if (!body) {
    return { title, outlines: [] };
  }

  const bodyOutlines = body.outline;
  let outlines: OPMLOutline[] = [];

  if (Array.isArray(bodyOutlines)) {
    outlines = bodyOutlines
      .map((child) => parseOutlineElement(child as Record<string, unknown>))
      .filter((o): o is OPMLOutline => o !== null);
  } else if (bodyOutlines && typeof bodyOutlines === 'object') {
    const parsed = parseOutlineElement(bodyOutlines as Record<string, unknown>);
    if (parsed) {
      outlines = [parsed];
    }
  }

  return { title, outlines };
}

/**
 * 从 OPML 中提取所有订阅源
 * （保留用于向后兼容）
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
