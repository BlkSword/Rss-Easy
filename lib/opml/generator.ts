/**
 * OPML 生成器
 * 用于生成 OPML 文件以导出订阅源
 */

import { db } from '@/lib/db';

interface Feed {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl: string | null;
}

interface Category {
  id: string;
  name: string;
  feeds: Feed[];
}

/**
 * 生成 OPML XML 字符串
 */
export async function generateOPML(userId: string): Promise<string> {
  // 获取所有分类及其订阅源
  const categories = await db.category.findMany({
    where: { userId },
    include: {
      feeds: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          feedUrl: true,
          siteUrl: true,
        },
        orderBy: { title: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // 获取未分类的订阅源
  const uncategorizedFeeds = await db.feed.findMany({
    where: {
      userId,
      isActive: true,
      categoryId: null,
    },
    select: {
      id: true,
      title: true,
      feedUrl: true,
      siteUrl: true,
    },
    orderBy: { title: 'asc' },
  });

  const date = new Date().toISOString();

  // 构建 OPML XML
  let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Rss-Easy Feeds Export</title>
    <dateCreated>${date}</dateCreated>
    <ownerName>Rss-Easy User</ownerName>
  </head>
  <body>
`;

  // 添加分类下的订阅源
  for (const category of categories) {
    if (category.feeds.length === 0) continue;

    opml += `    <outline text="${escapeXML(category.name)}" title="${escapeXML(category.name)}">\n`;

    for (const feed of category.feeds) {
      opml += `      <outline type="rss" text="${escapeXML(feed.title)}" title="${escapeXML(feed.title)}" xmlUrl="${escapeXML(feed.feedUrl)}"${feed.siteUrl ? ` htmlUrl="${escapeXML(feed.siteUrl)}"` : ''}/>\n`;
    }

    opml += `    </outline>\n`;
  }

  // 添加未分类的订阅源
  if (uncategorizedFeeds.length > 0) {
    opml += `    <outline text="Uncategorized" title="Uncategorized">\n`;
    for (const feed of uncategorizedFeeds) {
      opml += `      <outline type="rss" text="${escapeXML(feed.title)}" title="${escapeXML(feed.title)}" xmlUrl="${escapeXML(feed.feedUrl)}"${feed.siteUrl ? ` htmlUrl="${escapeXML(feed.siteUrl)}"` : ''}/>\n`;
    }
    opml += `    </outline>\n`;
  }

  opml += `  </body>
</opml>`;

  return opml;
}

/**
 * 转义 XML 特殊字符
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
