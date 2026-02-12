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

  // 注意：生产环境不创建测试数据
  // 如需创建测试数据，请在开发环境中手动执行

  console.log('');
  console.log('🎉 Seed 完成！');
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
