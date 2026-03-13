/**
 * 将旧的数据库队列任务迁移到新的 BullMQ 队列
 */

import { db } from '../lib/db';
import { addPreliminaryJob } from '../lib/queue/preliminary-processor';

async function migrate() {
  console.log('=== 队列迁移脚本 ===\n');

  // 1. 获取旧的 pending 任务
  const pendingTasks = await db.aIAnalysisQueue.findMany({
    where: { status: 'pending' },
    select: {
      id: true,
      entryId: true,
      priority: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`发现 ${pendingTasks.length} 个待迁移任务\n`);

  if (pendingTasks.length === 0) {
    console.log('没有需要迁移的任务');
    return;
  }

  // 2. 获取用户信息
  const entryIds = pendingTasks.map(t => t.entryId);
  const entries = await db.entry.findMany({
    where: { id: { in: entryIds } },
    select: {
      id: true,
      feedId: true,
      feed: { select: { userId: true } },
    },
  });

  const entryMap = new Map(entries.map(e => [e.id, e]));

  // 3. 添加到新的 BullMQ 队列
  let successCount = 0;
  let errorCount = 0;

  for (const task of pendingTasks) {
    try {
      const entry = entryMap.get(task.entryId);
      if (!entry) {
        console.log(`  ⚠️  文章不存在: ${task.entryId}`);
        errorCount++;
        continue;
      }

      await addPreliminaryJob({
        entryId: task.entryId,
        userId: entry.feed?.userId,
        priority: task.priority || 5,
      });

      successCount++;

      // 标记旧任务为已完成
      await db.aIAnalysisQueue.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          errorMessage: 'Migrated to BullMQ',
        },
      });

      if (successCount % 50 === 0) {
        console.log(`  已迁移 ${successCount}/${pendingTasks.length} 个任务...`);
      }
    } catch (err) {
      console.error(`  ❌ 迁移失败: ${task.entryId}`, err);
      errorCount++;
    }
  }

  console.log(`\n=== 迁移完成 ===`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${errorCount}`);
}

migrate()
  .then(() => {
    console.log('\n✅ 迁移脚本执行完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 迁移脚本失败:', err);
    process.exit(1);
  });
