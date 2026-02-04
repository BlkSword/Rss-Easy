/**
 * Prisma Seed 脚本
 * 用于初始化数据库测试数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始数据库 Seed...');

  // 清理现有数据（开发环境）
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 清理现有数据...');
    await prisma.reportEntry.deleteMany();
    await prisma.report.deleteMany();
    await prisma.aIAnalysisQueue.deleteMany();
    await prisma.readingHistory.deleteMany();
    await prisma.searchHistory.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.subscriptionRule.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.entry.deleteMany();
    await prisma.feed.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
  }

  // 创建测试用户
  console.log('👤 创建测试用户...');
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456', // password123 (需要在实际使用中替换)
      preferences: {
        theme: 'system',
        language: 'zh-CN',
        itemsPerPage: 20,
      },
      aiConfig: {
        provider: 'openai',
        model: 'gpt-4o',
        enableSummary: true,
        enableCategory: true,
        enableKeywords: true,
        enableSentiment: false,
      },
    },
  });

  console.log(`✅ 用户创建成功: ${testUser.email}`);

  // 创建默认分类
  console.log('📁 创建默认分类...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        userId: testUser.id,
        name: '技术',
        description: '技术相关文章',
        color: '#3B82F6',
        icon: '💻',
        sortOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        userId: testUser.id,
        name: '新闻',
        description: '新闻资讯',
        color: '#10B981',
        icon: '📰',
        sortOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        userId: testUser.id,
        name: '设计',
        description: '设计相关',
        color: '#8B5CF6',
        icon: '🎨',
        sortOrder: 3,
      },
    }),
    prisma.category.create({
      data: {
        userId: testUser.id,
        name: '产品',
        description: '产品经理相关',
        color: '#F59E0B',
        icon: '📦',
        sortOrder: 4,
      },
    }),
  ]);

  console.log(`✅ 创建了 ${categories.length} 个分类`);

  // 创建示例订阅源
  console.log('📡 创建示例订阅源...');
  const feeds = [
    {
      userId: testUser.id,
      categoryId: categories[0].id,
      title: 'Hacker News',
      description: 'Hacker News Front Page',
      feedUrl: 'https://news.ycombinator.com/rss',
      siteUrl: 'https://news.ycombinator.com',
      fetchInterval: 3600,
      priority: 8,
      isActive: true,
    },
    {
      userId: testUser.id,
      categoryId: categories[0].id,
      title: 'Next.js Blog',
      description: 'Next.js Official Blog',
      feedUrl: 'https://nextjs.org/blog/rss.xml',
      siteUrl: 'https://nextjs.org',
      fetchInterval: 7200,
      priority: 9,
      isActive: true,
    },
    {
      userId: testUser.id,
      categoryId: categories[0].id,
      title: 'Vue.js Blog',
      description: 'The official Vue.js blog',
      feedUrl: 'https://blog.vuejs.org/feed.xml',
      siteUrl: 'https://vuejs.org',
      fetchInterval: 7200,
      priority: 7,
      isActive: true,
    },
    {
      userId: testUser.id,
      categoryId: categories[0].id,
      title: 'React Blog',
      description: 'React Official Blog',
      feedUrl: 'https://react.dev/blog/rss.xml',
      siteUrl: 'https://react.dev',
      fetchInterval: 7200,
      priority: 8,
      isActive: true,
    },
    {
      userId: testUser.id,
      categoryId: categories[1].id,
      title: 'TechCrunch',
      description: 'Technology and startup news',
      feedUrl: 'https://techcrunch.com/feed/',
      siteUrl: 'https://techcrunch.com',
      fetchInterval: 3600,
      priority: 6,
      isActive: true,
    },
    {
      userId: testUser.id,
      categoryId: categories[2].id,
      title: 'Smashing Magazine',
      description: 'Web design and development',
      feedUrl: 'https://www.smashingmagazine.com/feed/',
      siteUrl: 'https://www.smashingmagazine.com',
      fetchInterval: 86400,
      priority: 5,
      isActive: true,
    },
  ];

  const createdFeeds = await Promise.all(
    feeds.map((feed) =>
      prisma.feed.upsert({
        where: {
          userId_feedUrl: {
            userId: feed.userId,
            feedUrl: feed.feedUrl,
          },
        },
        update: {},
        create: feed,
      })
    )
  );

  console.log(`✅ 创建了 ${createdFeeds.length} 个订阅源`);

  // 创建示例文章（用于展示）
  console.log('📝 创建示例文章...');
  const sampleEntries = [
    {
      feedId: createdFeeds[0].id,
      title: 'Claude 4.5 发布：重新定义AI编程助手的新标准',
      url: 'https://example.com/claude-4-5',
      content: 'Anthropic发布了最新的Claude 4.5模型，在代码生成、调试和架构设计方面实现了重大突破...',
      summary: 'Anthropic发布了最新的Claude 4.5模型，在代码生成、调试和架构设计方面实现了重大突破。',
      author: 'AI科技前沿',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      contentHash: 'hash1',
      isRead: false,
      isStarred: true,
      aiSummary: 'Claude 4.5在编程能力上显著提升，支持更复杂的代码理解和生成任务。',
      aiCategory: 'AI/机器学习',
      aiKeywords: ['Claude', 'AI', '编程助手'],
      aiSentiment: 'positive',
      aiImportanceScore: 8.5,
      readingTime: 480,
    },
    {
      feedId: createdFeeds[1].id,
      title: 'Next.js 15正式发布：Turbopack默认启用带来5倍构建速度提升',
      url: 'https://example.com/nextjs-15',
      content: 'Vercel宣布Next.js 15正式发布，默认启用Turbopack，构建速度提升5倍，同时推出了多项新特性...',
      summary: 'Vercel宣布Next.js 15正式发布，默认启用Turbopack，构建速度提升5倍，同时推出了多项新特性。',
      author: '前端周刊',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      contentHash: 'hash2',
      isRead: false,
      isStarred: false,
      aiSummary: 'Next.js 15默认启用Turbopack，构建速度大幅提升，同时改进了开发体验。',
      aiCategory: '前端开发',
      aiKeywords: ['Next.js', 'Turbopack', '构建工具'],
      aiSentiment: 'positive',
      aiImportanceScore: 7.8,
      readingTime: 360,
    },
    {
      feedId: createdFeeds[2].id,
      title: 'Rust 2024年路线图：聚焦性能、安全与开发者体验',
      url: 'https://example.com/rust-2024',
      content: 'Rust团队公布了2024年的发展路线图，重点包括编译器性能优化、安全增强以及工具链改进...',
      summary: 'Rust团队公布了2024年的发展路线图，重点包括编译器性能优化、安全增强以及工具链改进。',
      author: 'Rust语言中文社区',
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      contentHash: 'hash3',
      isRead: true,
      isStarred: false,
      aiSummary: 'Rust 2024将重点优化编译器性能，增强安全特性，并改进开发工具链。',
      aiCategory: '后端开发',
      aiKeywords: ['Rust', '编译器', '性能优化'],
      aiSentiment: 'positive',
      aiImportanceScore: 7.2,
      readingTime: 420,
    },
    {
      feedId: createdFeeds[3].id,
      title: 'PostgreSQL 17发布：支持增量备份和性能监控增强',
      url: 'https://example.com/postgresql-17',
      content: 'PostgreSQL 17正式发布，引入了增量备份功能，增强了性能监控工具，并修复了多个重要bug...',
      summary: 'PostgreSQL 17正式发布，引入了增量备份功能，增强了性能监控工具，并修复了多个重要bug。',
      author: '数据库技术',
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      contentHash: 'hash4',
      isRead: true,
      isStarred: false,
      aiSummary: 'PostgreSQL 17新增增量备份功能，性能监控得到显著增强。',
      aiCategory: '数据库',
      aiKeywords: ['PostgreSQL', '数据库', '备份'],
      aiSentiment: 'positive',
      aiImportanceScore: 6.9,
      readingTime: 300,
    },
    {
      feedId: createdFeeds[4].id,
      title: 'Kubernetes最佳实践：在边缘计算场景下的部署策略',
      url: 'https://example.com/k8s-edge',
      content: '随着边缘计算的兴起，在边缘节点部署Kubernetes集群成为新的技术趋势。本文分享了一套完整的实践方案...',
      summary: '随着边缘计算的兴起，在边缘节点部署Kubernetes集群成为新的技术趋势。本文分享了一套完整的实践方案。',
      author: '云原生技术',
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      contentHash: 'hash5',
      isRead: false,
      isStarred: false,
      aiSummary: '介绍了在边缘计算场景下部署Kubernetes的最佳实践和注意事项。',
      aiCategory: '云计算/DevOps',
      aiKeywords: ['Kubernetes', '边缘计算', 'DevOps'],
      aiSentiment: 'neutral',
      aiImportanceScore: 7.5,
      readingTime: 600,
    },
  ];

  const createdEntries = await Promise.all(
    sampleEntries.map((entry) =>
      prisma.entry.upsert({
        where: { contentHash: entry.contentHash },
        update: {},
        create: entry,
      })
    )
  );

  console.log(`✅ 创建了 ${createdEntries.length} 篇示例文章`);

  // 创建阅读历史
  console.log('📖 创建阅读历史...');
  await prisma.readingHistory.createMany({
    data: createdEntries
      .filter((e) => e.isRead)
      .map((entry) => ({
        userId: testUser.id,
        entryId: entry.id,
        readProgress: 100,
        readingTime: entry.readingTime || 300,
        firstOpenedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        lastOpenedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        source: 'feed',
      })),
  });

  console.log(`✅ 创建了阅读历史记录`);

  // 更新订阅源统计
  console.log('📊 更新订阅源统计...');
  for (const feed of createdFeeds) {
    const entryCount = await prisma.entry.count({
      where: { feedId: feed.id },
    });
    const unreadCount = await prisma.entry.count({
      where: { feedId: feed.id, isRead: false },
    });

    await prisma.feed.update({
      where: { id: feed.id },
      data: {
        totalEntries: entryCount,
        unreadCount,
      },
    });
  }

  console.log('✅ 订阅源统计已更新');

  console.log('');
  console.log('🎉 Seed 完成！');
  console.log('');
  console.log('📋 测试账号信息：');
  console.log('   邮箱: test@example.com');
  console.log('   密码: password123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
