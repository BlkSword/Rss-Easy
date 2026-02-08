# AI-Native 改造快速开始指南

## 第一步：数据库迁移

### 1.1 更新 Prisma Schema

在 `prisma/schema.prisma` 中添加以下模型：

```prisma
// 新增：用户阅读行为表
model ReadingSession {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  entryId     String    @map("entry_id")

  startedAt   DateTime  @default(now()) @map("started_at")
  endedAt     DateTime? @map("ended_at")
  dwellTime   Int       @default(0) @map("dwell_time")
  scrollDepth Float     @default(0) @map("scroll_depth")
  isCompleted Boolean   @default(false) @map("is_completed")
  isStarred   Boolean   @default(false) @map("is_starred")
  rating      Int?      @map("rating")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  entry       Entry     @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@unique([userId, entryId, startedAt])
  @@index([userId, startedAt])
  @@index([entryId])
  @@map("reading_sessions")
}

// 新增：用户偏好画像
model UserPreference {
  id              String   @id @default(uuid())
  userId          String   @unique @map("user_id")

  topicWeights    Json     @default("{}") @map("topic_weights")
  preferredDepth  String?  @map("preferred_depth")
  preferredLength String?  @map("preferred_length")
  excludedTags    String[] @default([]) @map("excluded_tags")

  totalReadTime   Int      @default(0) @map("total_read_time")
  totalEntries    Int      @default(0) @map("total_entries")
  avgCompletion   Float    @default(0) @map("avg_completion")

  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("user_preferences")
}

// 扩展 User 模型
model User {
  // ... 保留现有字段 ...

  // 新增关联
  readingSessions ReadingSession[]
  preferences     UserPreference?
}
```

### 1.2 扩展现有 Entry 模型

```prisma
model Entry {
  // ... 保留所有现有字段 ...

  // 新增：增强分析字段
  aiOneLineSummary   String?   @map("ai_one_line_summary") @db.Text
  aiMainPoints       Json?     @map("ai_main_points")
  aiKeyQuotes        Json?     @map("ai_key_quotes")
  aiScoreDimensions  Json?     @map("ai_score_dimensions")

  // 分析元数据
  aiAnalysisModel    String?   @map("ai_analysis_model")
  aiProcessingTime   Int?      @map("ai_processing_time")
  aiReflectionRounds Int       @default(0) @map("ai_reflection_rounds")

  // 新增关联
  readingSessions    ReadingSession[]
}
```

### 1.3 应用迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 推送 schema 到数据库（开发环境）
npx prisma db push
```

---

## 第二步：安装依赖

### 2.1 安装新增依赖

```bash
# Markdown 解析器（用于智能分段）
npm install marked

# BullMQ 类型定义
npm install -D @types/bullmq
```

---

## 第三步：测试基础功能

### 3.1 创建测试脚本

创建 `scripts/test-deep-analysis.ts`：

```typescript
import { db } from '@/lib/db';
import { SegmentedAnalyzer } from '@/lib/ai/analysis/segmented-analyzer';
import { ReflectionEngine } from '@/lib/ai/analysis/reflection-engine';
import { getDefaultAIService } from '@/lib/ai/client';

async function testDeepAnalysis() {
  // 获取一篇测试文章
  const entry = await db.entry.findFirst({
    where: {
      content: {
        not: null,
      },
    },
  });

  if (!entry) {
    console.error('没有找到测试文章');
    return;
  }

  console.log('开始测试深度分析...');
  console.log('文章标题:', entry.title);

  const aiService = getDefaultAIService();
  const llm = {
    chat: async (params: any) => {
      const result = await aiService.analyzeArticle(params.messages[1].content, {
        summary: true,
        keywords: true,
        category: true,
      });
      return { content: JSON.stringify(result) };
    },
  } as any;

  // 测试分段分析
  const analyzer = new SegmentedAnalyzer(llm);
  const analysisResult = await analyzer.analyze(entry.content!, {
    title: entry.title,
    author: entry.author || undefined,
  });

  console.log('\n=== 分析结果 ===');
  console.log('一句话总结:', analysisResult.oneLineSummary);
  console.log('摘要:', analysisResult.summary);
  console.log('主要观点:', analysisResult.mainPoints.map(p => p.point));
  console.log('标签:', analysisResult.tags);
  console.log('评分:', analysisResult.aiScore);
  console.log('处理时间:', analysisResult.processingTime, 'ms');

  // 测试反思引擎
  console.log('\n=== 测试反思引擎 ===');
  const reflectionEngine = new ReflectionEngine(llm);
  const refinedResult = await reflectionEngine.refine(
    entry.content!,
    analysisResult,
    1
  );

  console.log('反思轮数:', refinedResult.reflectionRounds);
  console.log('优化后评分:', refinedResult.aiScore);
}

testDeepAnalysis()
  .then(() => {
    console.log('测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
```

### 3.2 运行测试

```bash
npx tsx scripts/test-deep-analysis.ts
```

---

## 第四步：启动队列处理器

### 4.1 创建队列启动脚本

创建 `scripts/start-queue-worker.ts`：

```typescript
import { createDeepAnalysisWorker } from '@/lib/queue/deep-analysis-processor';

const worker = createDeepAnalysisWorker();

console.log('深度分析队列处理器已启动');

worker.on('completed', (job) => {
  console.log(`任务完成: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`任务失败: ${job?.id}`, err.message);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('正在关闭队列处理器...');
  await worker.close();
  process.exit(0);
});
```

### 4.2 启动队列

```bash
# 终端1：启动队列处理器
npx tsx scripts/start-queue-worker.ts

# 终端2：添加测试任务
node -e "
const { addDeepAnalysisJob } = require('./lib/queue/deep-analysis-processor');
addDeepAnalysisJob({ entryId: 'your-entry-id', priority: 5 })
  .then(id => console.log('任务ID:', id))
  .catch(err => console.error(err));
"
```

---

## 第五步：API 集成

### 5.1 添加 API 端点

在 `server/api/entries.ts` 中添加：

```typescript
import { addDeepAnalysisJob } from '@/lib/queue/deep-analysis-processor';

export const entriesRouter = router({
  // ... 现有方法 ...

  // 新增：触发深度分析
  triggerDeepAnalysis: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      priority: z.number().min(1).max(10).default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const jobId = await addDeepAnalysisJob({
        entryId: input.entryId,
        userId: ctx.userId,
        priority: input.priority,
      });

      return { jobId, status: 'queued' };
    }),
});
```

### 5.2 测试 API

```bash
# 使用 tRPC 客户端测试
curl -X POST http://localhost:3000/api/trpc/entries.triggerDeepAnalysis \
  -H "Content-Type: application/json" \
  -d '{"entryId": "your-entry-id", "priority": 5}'
```

---

## 第六步：前端集成

### 6.1 创建分析展示组件

参考 `components/ai/DeepAnalysisCard.tsx`（已在方案中提供）

### 6.2 添加到文章详情页

在 `app/(dashboard)/entries/[id]/page.tsx` 中添加：

```typescript
import { DeepAnalysisCard } from '@/components/ai/DeepAnalysisCard';

export default function EntryDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* ... 现有内容 ... */}

      <DeepAnalysisCard entryId={params.id} />
    </div>
  );
}
```

---

## 常见问题

### Q: 如何处理 AI API 限流？

A: 在队列配置中设置合理的并发数和重试延迟：

```typescript
export const deepAnalysisQueue = new Queue('deep-analysis', {
  connection: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 增加延迟
    },
  },
});

const worker = new Worker('deep-analysis', processor, {
  connection: REDIS_CONFIG,
  concurrency: 2, // 降低并发数
});
```

### Q: 如何降低 AI 成本？

A: 1. 使用高性价比模型（如 DeepSeek）做初筛
   2. 启用结果缓存，避免重复分析
   3. 设置最小文章长度阈值

### Q: 如何监控队列状态？

A: 使用 Bull Board 或创建简单的监控端点：

```typescript
// server/api/queue-status.ts
import { getQueueStatus } from '@/lib/queue/deep-analysis-processor';

export const queueStatusRouter = router({
  getStatus: publicProcedure
    .query(async () => {
      return await getQueueStatus();
    }),
});
```

---

## 下一步

1. 完成数据库迁移
2. 运行测试脚本验证基础功能
3. 启动队列处理器
4. 逐步添加 API 和前端组件
5. 根据实际效果调整参数

详细内容请参考 `docs/AI-NATIVE-TRANSFORM.md`。
