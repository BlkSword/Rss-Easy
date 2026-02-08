# AI-Native 改造实施指南

## 完成状态总览

### ✅ 已完成的模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库迁移 | ✅ 完成 | Prisma schema 已更新 |
| 类型定义 | ✅ 完成 | 所有核心类型已定义 |
| 工作流引擎 | ✅ 完成 | WorkflowOrchestrator 已实现 |
| 分段分析器 | ✅ 完成 | SegmentedAnalyzer 已实现 |
| 反思引擎 | ✅ 完成 | ReflectionEngine 已实现 |
| 个性化评分 | ✅ 完成 | PersonalScorer 已实现 |
| 队列处理器 | ✅ 完成 | BullMQ Worker 已实现 |
| tRPC 路由 | ✅ 完成 | entries + analytics 路由已扩展 |
| 前端 Hook | ✅ 完成 | useReadingTracking 已实现 |
| 前端组件 | ✅ 完成 | DeepAnalysisCard 已实现 |
| 测试脚本 | ✅ 完成 | 测试和管理脚本已创建 |

---

## 快速启动指南

### 第一步：安装依赖

```bash
# 安装新增的依赖
npm install marked

# 或者使用其他包管理器
pnpm install marked
yarn add marked
```

### 第二步：应用数据库迁移

```bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到数据库（开发环境）
npm run db:push

# 如果需要创建迁移（生产环境）
npm run db:migrate
```

### 第三步：验证数据库

```bash
# 打开 Prisma Studio 查看新表
npm run db:studio
```

确认以下新表已创建：
- `reading_sessions`
- `user_preferences`
- `article_relations`

确认 Entry 表新增字段：
- `aiOneLineSummary`
- `aiMainPoints`
- `aiKeyQuotes`
- `aiScoreDimensions`
- `aiAnalysisModel`
- `aiProcessingTime`
- `aiReflectionRounds`
- `aiAnalyzedAt`

### 第四步：测试基础功能

```bash
# 运行测试脚本
npm run test:deep-analysis
```

预期输出：
```
=== AI-Native 深度分析测试 ===

1. 获取测试文章...
✓ 找到文章: [文章标题]
  Feed: [Feed名称]
  内容长度: [数字] 字符

2. 初始化 AI 服务...
✓ AI 服务初始化完成

3. 测试分段分析引擎...
✓ 分段分析完成
  一句话总结: [总结内容]
  摘要: [摘要内容]
  主要观点数: [数字]
  标签: [标签列表]
  评分: [评分]/10
  处理时间: [时间]ms

=== 测试完成 ===
```

### 第五步：启动队列处理器（可选）

```bash
# 终端1：启动队列处理器
npm run worker:deep-analysis

# 终端2：添加测试任务
npm run queue add-batch 5 5
```

### 第六步：启动应用

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm run start
```

访问 http://localhost:3000 查看效果。

---

## 前端集成

### 在文章详情页添加深度分析卡片

```tsx
// app/(dashboard)/entries/[id]/page.tsx

import { DeepAnalysisCard } from '@/components/ai/DeepAnalysisCard';
import { useReadingTracking } from '@/hooks/useReadingTracking';

export default function EntryDetailPage({ params }: { params: { id: string } }) {
  // 启用阅读行为追踪
  useReadingTracking({
    entryId: params.id,
    enabled: true,
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 文章内容 */}
      <ArticleContent id={params.id} />

      {/* AI 深度分析 */}
      <DeepAnalysisCard entryId={params.id} />
    </div>
  );
}
```

### 在文章列表中添加深度分析按钮

```tsx
// components/entries/EntryList.tsx

import { api } from '@/trpc/react';
import { Sparkles } from 'lucide-react';

function EntryItem({ entry }: { entry: Entry }) {
  const { mutate: triggerAnalysis } = api.entries.triggerDeepAnalysis.useMutation();

  return (
    <div className="entry-item">
      <h3>{entry.title}</h3>
      <p>{entry.summary}</p>

      {/* 深度分析按钮 */}
      {!entry.aiAnalyzedAt && (
        <button
          onClick={() => triggerAnalysis({ entryId: entry.id })}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 rounded"
        >
          <Sparkles className="h-4 w-4" />
          AI 深度分析
        </button>
      )}
    </div>
  );
}
```

---

## API 使用示例

### 触发深度分析

```typescript
import { api } from '@/trpc/react';

function MyComponent() {
  const { mutate: triggerAnalysis } = api.entries.triggerDeepAnalysis.useMutation();

  const handleAnalyze = (entryId: string) => {
    triggerAnalysis(
      { entryId, priority: 5 },
      {
        onSuccess: (result) => {
          console.log('任务已添加:', result.jobId);
        },
      }
    );
  };

  return <button onClick={() => handleAnalyze('entry-id')}>开始分析</button>;
}
```

### 获取深度分析结果

```typescript
import { api } from '@/trpc/react';

function AnalysisDisplay({ entryId }: { entryId: string }) {
  const { data: analysis, isLoading } = api.entries.getDeepAnalysis.useQuery({
    entryId,
  });

  if (isLoading) return <div>加载中...</div>;
  if (!analysis) return <div>暂无分析结果</div>;

  return (
    <div>
      <h2>{analysis.oneLineSummary}</h2>
      <p>{analysis.summary}</p>
      <div>评分: {analysis.aiScore}/10</div>
    </div>
  );
}
```

### 记录阅读行为

```typescript
import { api } from '@/trpc/react';

function ArticleReader({ entryId }: { entryId: string }) {
  const { mutate: trackReading } = api.analytics.trackReading.useMutation();

  // 组件卸载时自动记录
  useEffect(() => {
    return () => {
      trackReading({
        entryId,
        dwellTime: 120,
        scrollDepth: 0.8,
        isCompleted: true,
      });
    };
  }, [entryId, trackReading]);

  return <div>文章内容...</div>;
}
```

### 获取个性化推荐

```typescript
import { api } from '@/trpc/react';

function PersonalizedFeed() {
  const { data, fetchNextPage, hasNextPage } =
    api.analytics.getPersonalizedFeed.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
      }
    );

  return (
    <div>
      {data?.pages.map(page =>
        page.items.map(entry => (
          <EntryCard key={entry.id} entry={entry} />
        ))
      )}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>加载更多</button>
      )}
    </div>
  );
}
```

---

## 队列管理

### 查看队列状态

```bash
npm run queue status
```

### 添加单个任务

```bash
npm run queue add <entryId> [priority]
```

示例：
```bash
npm run queue add entry-123 5
```

### 批量添加任务

```bash
npm run queue add-batch [limit] [priority]
```

示例：
```bash
npm run queue add-batch 20 3
```

### 查看任务状态

```bash
npm run queue job <jobId>
```

### 重试失败任务

```bash
npm run queue retry [limit]
```

---

## 性能优化建议

### 1. AI 成本优化

在 `lib/ai/analysis/segmented-analyzer.ts` 中调整模型选择：

```typescript
const analysisModel = 'deepseek-chat'; // 使用高性价比模型
const reflectionModel = 'gpt-4o-mini'; // 反思使用中等模型
```

### 2. 队列并发控制

在 `lib/queue/deep-analysis-processor.ts` 中调整并发数：

```typescript
concurrency: 2, // 降低并发数减少 API 调用
```

### 3. 结果缓存

在 tRPC 路由中添加缓存：

```typescript
getDeepAnalysis: protectedProcedure
  .input(z.object({ entryId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    // 使用 tRPC 缓存
    const entry = await ctx.db.entry.findFirst({
      where: { id: input.entryId },
      cacheStrategy: { swr: 60, ttl: 3600 }, // 缓存1小时
    });
    // ...
  })
```

### 4. 分段大小调整

根据文章长度动态调整：

```typescript
const segmentSize = content.length > 10000 ? 4000 : 3000;
```

---

## 监控和调试

### 查看队列状态

在浏览器中访问（需要实现对应端点）：

```
GET /api/analytics/queue-status
```

### 查看分析历史

在 Prisma Studio 中：

```bash
npm run db:studio
```

浏览 `reading_sessions` 和 `user_preferences` 表。

### 启用调试日志

在 `.env.local` 中添加：

```env
DEBUG=rss-easy:*
NODE_ENV=development
```

---

## 常见问题

### Q: 测试脚本报错 "AI 服务初始化失败"

A: 检查环境变量配置：
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
```

### Q: 队列任务一直处于 pending 状态

A: 确保 Redis 正在运行：
```bash
# Docker
docker ps | grep redis

# 或启动 Redis
redis-server
```

### Q: 深度分析按钮点击后没有反应

A: 检查 tRPC 连接和权限：
1. 确保用户已登录
2. 检查浏览器控制台错误
3. 验证 API 路由是否正确注册

### Q: 分析结果不准确

A: 调整模型和参数：
1. 使用更强的模型（如 GPT-4o）
2. 增加反思轮数
3. 调整 Prompt 模板

---

## 下一步优化

### Phase 4: 高级功能

1. **向量搜索**
   - 安装 pgvector 扩展
   - 实现向量存储接口
   - 实现相似文章推荐

2. **知识图谱**
   - 实现关系抽取
   - 构建文章关系网络
   - 创建图谱可视化

3. **高级个性化**
   - 实现用户兴趣向量化
   - 实现协同过滤推荐
   - 实现时间衰减因子

4. **自动化报告**
   - 实现周报自动生成
   - 实现阅读趋势分析
   - 实现个性化报告推送

---

## 技术支持

遇到问题？
1. 查看 `docs/AI-NATIVE-TRANSFORM.md` 详细方案
2. 查看 `docs/AI-NATIVE-QUICKSTART.md` 快速开始
3. 检查 `docs/AI-NATIVE-CHECKLIST.md` 实施清单

---

**祝部署顺利！🎉**
