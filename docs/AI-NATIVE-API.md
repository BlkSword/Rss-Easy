# AI-Native API 使用文档

本文档提供所有新增 AI-Native API 的详细使用说明。

---

## tRPC API

### entries Router - 深度分析相关

#### triggerDeepAnalysis

触发文章的 AI 深度分析。

**输入参数:**
```typescript
{
  entryId: string;    // 文章ID
  priority: number;  // 优先级 1-10，数字越小优先级越高（可选）
}
```

**返回结果:**
```typescript
{
  status: 'queued' | 'already_analyzed';
  jobId?: string;    // 队列任务ID
  message?: string;
}
```

**使用示例:**
```typescript
const { mutate } = api.entries.triggerDeepAnalysis.useMutation();

mutate(
  { entryId: 'entry-123', priority: 5 },
  {
    onSuccess: (result) => {
      console.log('任务已添加:', result.jobId);
    }
  }
);
```

#### getDeepAnalysis

获取文章的深度分析结果。

**输入参数:**
```typescript
{
  entryId: string;    // 文章ID
}
```

**返回结果:**
```typescript
{
  entryId: string;
  title: string;
  feedName: string;
  oneLineSummary?: string;     // 一句话总结
  summary?: string;             // 详细摘要
  mainPoints?: Array<{          // 主要观点
    point: string;
    explanation: string;
    importance: number;
  }>;
  keyQuotes?: Array<{           // 关键引用
    quote: string;
    significance: string;
  }>;
  scoreDimensions?: {           // 评分维度
    depth: number;
    quality: number;
    practicality: number;
    novelty: number;
  };
  aiScore: number;              // 综合评分 1-10
  analysisModel?: string;       // 使用的模型
  processingTime?: number;      // 处理耗时(ms)
  reflectionRounds?: number;    // 反思轮数
  analyzedAt?: Date;            // 分析时间
}
```

**使用示例:**
```typescript
const { data: analysis } = api.entries.getDeepAnalysis.useQuery({
  entryId: 'entry-123',
});

if (analysis) {
  console.log('评分:', analysis.aiScore);
  console.log('总结:', analysis.oneLineSummary);
}
```

#### getAnalysisStatus

批量获取文章的分析状态。

**输入参数:**
```typescript
{
  entryIds: string[];  // 文章ID数组
}
```

**返回结果:**
```typescript
Record<string, {
  analyzed: boolean;
  processingTime?: number;
  reflectionRounds?: number;
  score?: number;
}>
```

---

### analytics Router - 用户行为分析

#### trackReading

记录用户阅读行为。

**输入参数:**
```typescript
{
  entryId: string;
  dwellTime: number;          // 停留时间（秒）
  scrollDepth: number;        // 滚动深度 0-1
  isCompleted: boolean;       // 是否阅读完成
  isStarred?: boolean;        // 是否加星标
  rating?: number;            // 用户评分 1-5
  attentionSegments?: Array<{ // 关注段落
    startOffset: number;
    endOffset: number;
    duration: number;
  }>;
}
```

**使用示例:**
```typescript
const { mutate: trackReading } = api.analytics.trackReading.useMutation();

// 组件卸载时自动记录
useEffect(() => {
  return () => {
    trackReading({
      entryId: 'entry-123',
      dwellTime: 120,
      scrollDepth: 0.8,
      isCompleted: true,
    });
  };
}, []);
```

#### getProfile

获取用户阅读画像。

**返回结果:**
```typescript
{
  userId: string;
  topicWeights: Record<string, number>;  // 主题权重
  preferredDepth?: 'deep' | 'medium' | 'light';
  preferredLength?: 'short' | 'medium' | 'long';
  excludedTags: string[];
  stats: {
    totalReadTime: number;
    totalEntries: number;
    avgCompletion: number;
    avgDwellTime: number;
    diversityScore: number;
  };
}
```

#### getReadingStats

获取阅读统计数据。

**输入参数:**
```typescript
{
  period: 'day' | 'week' | 'month' | 'all';
}
```

**返回结果:**
```typescript
{
  period: string;
  startDate: Date;
  endDate: Date;
  summary: {
    totalEntries: number;
    totalReadTime: number;
    avgDwellTime: number;
    completionRate: number;
    starredCount: number;
  };
  topTags: Array<{
    tag: string;
    count: number;
  }>;
}
```

#### getPersonalizedFeed

获取个性化推荐流。

**输入参数:**
```typescript
{
  limit?: number;           // 默认 20
  cursor?: string;          // 分页游标
  filters?: {
    minScore?: number;      // 最低评分
    tags?: string[];        // 标签过滤
    excludeRead?: boolean;  // 排除已读
  };
}
```

**返回结果:**
```typescript
{
  items: Array<{
    id: string;
    title: string;
    // ... 其他文章字段
    personalScore?: number;  // 个性化评分
  }>;
  pagination: {
    nextCursor?: string;
    hasNext: boolean;
  };
  personalized: boolean;
}
```

---

### recommendations Router - 推荐系统

#### getRelated

获取相关文章。

**输入参数:**
```typescript
{
  entryId: string;
  limit?: number;                    // 默认 5
  relationType?: 'similar' | 'prerequisite' | 'extension' | 'contradiction' | 'all';
}
```

**返回结果:**
```typescript
{
  items: Array<{
    id: string;
    title: string;
    summary?: string;
    url: string;
    publishedAt: Date;
    feed: {
      title: string;
      iconUrl?: string;
    };
    relationType?: string;
    strength?: number;    // 关系强度 0-1
    reason?: string;      // 关系原因
  }>;
}
```

#### getKnowledgeGraph

获取知识图谱数据。

**输入参数:**
```typescript
{
  entryId: string;
  depth?: number;  // 图谱深度 1-3，默认 2
}
```

**返回结果:**
```typescript
{
  nodes: Array<{
    id: string;
    title: string;
    layer: number;  // 距中心的层数
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;    // 关系类型
    strength: number; // 关系强度 0-1
  }>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    filteredNodes: number;
    filteredEdges: number;
  };
}
```

#### getRecommendationReason

获取推荐理由。

**输入参数:**
```typescript
{
  entryId: string;
}
```

**返回结果:**
```typescript
{
  entryId: string;
  title: string;
  reasons: string[];    // 推荐理由列表
  confidence: number;   // 推荐置信度 0-1
}
```

---

## 队列管理 API

### 队列状态查询

```bash
npm run queue status
```

### 添加单个任务

```bash
npm run queue add <entryId> [priority]
```

### 批量添加任务

```bash
npm run queue add-batch [limit] [priority]
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

## 前端 Hooks

### useReadingTracking

自动追踪用户阅读行为。

```typescript
import { useReadingTracking } from '@/hooks/useReadingTracking';

function ArticleReader({ entryId }: { entryId: string }) {
  const { scrollDepth, isActive } = useReadingTracking({
    entryId,
    enabled: true,              // 是否启用追踪
    reportInterval: 30000,      // 上报间隔（毫秒）
    minDwellTime: 5,            // 最小停留时间（秒）
    minScrollDepth: 0.1,        // 最小滚动深度
  });

  return (
    <div>
      <p>滚动深度: {Math.round(scrollDepth * 100)}%</p>
      <p>追踪状态: {isActive ? '活跃' : '未活跃'}</p>
    </div>
  );
}
```

---

## 后端服务

### 向量存储

```typescript
import { getVectorStore } from '@/lib/ai/embedding/vector-store';

const store = getVectorStore();

// 存储向量
await store.store('entry-123', vectorArray, { category: 'tech' });

// 搜索相似向量
const results = await store.search(queryVector, 10, 0.7);
```

### 关系抽取

```typescript
import { getRelationExtractor } from '@/lib/ai/knowledge/relation-extractor';

const extractor = getRelationExtractor();

// 查找相关文章
const relations = await extractor.findRelatedArticles('entry-123', {
  limit: 5,
  relationType: 'similar',
  minSimilarity: 0.75,
});

// 构建知识图谱
const graph = await extractor.buildKnowledgeGraph('entry-123', 2);
```

### 用户偏好更新

```typescript
import { updateUserPreferences } from '@/lib/ai/scoring/preference-tracker';

// 自动更新用户偏好
await updateUserPreferences(userId);
```

---

## 错误处理

所有 API 都遵循标准的 tRPC 错误处理：

```typescript
try {
  await api.entries.triggerDeepAnalysis.mutateAsync({ entryId });
} catch (error) {
  if (error.data?.code === 'NOT_FOUND') {
    console.log('文章不存在');
  } else {
    console.log('其他错误:', error.message);
  }
}
```

常见错误代码：
- `NOT_FOUND`: 资源不存在
- `UNAUTHORIZED`: 未授权访问
- `BAD_REQUEST`: 请求参数错误
- `INTERNAL_SERVER_ERROR`: 服务器内部错误

---

## 性能优化建议

### 1. 使用无限滚动

对于列表数据，推荐使用 `useInfiniteQuery`：

```typescript
const { data, fetchNextPage } = api.analytics.getPersonalizedFeed
  .useInfiniteQuery({ limit: 20 });
```

### 2. 缓存分析结果

深度分析结果可以缓存较长时间：

```typescript
const { data } = api.entries.getDeepAnalysis.useQuery({
  entryId,
  staleTime: 1000 * 60 * 60, // 1小时
});
```

### 3. 延迟加载非关键功能

知识图谱等复杂功能可以延迟加载：

```typescript
const [showGraph, setShowGraph] = useState(false);

// 用户点击时才加载
```

---

## 完整示例

### 创建一个完整的个性化阅读页面

```tsx
'use client';

import { useReadingTracking } from '@/hooks/useReadingTracking';
import { DeepAnalysisCard } from '@/components/ai/DeepAnalysisCard';
import { PersonalizedFeed } from '@/components/feeds/PersonalizedFeed';
import { KnowledgeGraph } from '@/components/knowledge/KnowledgeGraph';
import { api } from '@/trpc/react';

export default function PersonalizedReadingPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 个性化推荐流 */}
      <section>
        <PersonalizedFeed limit={10} />
      </section>

      {/* 阅读行为追踪 + 深度分析 */}
      <ArticleWithAnalysis entryId="entry-123" />
    </div>
  );
}

function ArticleWithAnalysis({ entryId }: { entryId: string }) {
  // 启用阅读行为追踪
  useReadingTracking({ entryId });

  return (
    <>
      {/* 文章内容 */}
      <ArticleContent entryId={entryId} />

      {/* AI 深度分析 */}
      <DeepAnalysisCard entryId={entryId} />

      {/* 知识图谱 */}
      <KnowledgeGraph entryId={entryId} depth={2} />
    </>
  );
}
```

---

## 更新日志

- **2025-01-XX**: 初始版本，包含所有核心 API

---

**如有疑问，请参考其他文档或提交 Issue。**
