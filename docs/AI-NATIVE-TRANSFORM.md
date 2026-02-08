# Rss-Easy AI-Native 改造方案

> 基于现有架构的详细实施计划

## 一、现有架构分析

### 1.1 现有 AI 能力

| 组件 | 当前状态 | 文件位置 |
|------|---------|----------|
| AI 服务提供商 | ✅ 已实现（OpenAI/Anthropic/DeepSeek/Ollama/自定义） | `lib/ai/client.ts` |
| AI 分析队列 | ✅ 已实现（BullMQ + Redis） | `lib/ai/queue.ts` |
| 基础 AI 字段 | ✅ 已实现 | Entry 模型中的 aiSummary, aiKeywords, aiSentiment, aiCategory, aiImportanceScore |
| 向量嵌入 | ✅ 已实现（titleEmbedding, contentEmbedding） | Entry 模型 |
| tRPC 上下文 | ✅ 已实现（userId 注入） | `server/trpc/context.ts` |

### 1.2 需要新增的能力

| 功能 | 优先级 | 复杂度 |
|------|--------|--------|
| 分段分析引擎（Map-Reduce） | P0 | 高 |
| 反思优化引擎（Self-Refinement） | P1 | 中 |
| 个性化评分系统 | P0 | 高 |
| 工作流编排引擎 | P1 | 高 |
| 用户行为追踪 | P0 | 中 |
| 知识图谱关联 | P2 | 高 |
| 个性化推荐流 | P1 | 中 |

## 二、数据库迁移方案

### 2.1 现有 Entry 模型分析

```prisma
// 当前 Entry 模型已有的 AI 字段
model Entry {
  // ... 基础字段 ...

  // AI增强信息（已有）
  aiSummary         String?   @map("ai_summary") @db.Text
  aiKeywords        String[]  @default([]) @map("ai_keywords")
  aiSentiment       String?   @map("ai_sentiment")
  aiCategory        String?   @map("ai_category")
  aiImportanceScore Float     @default(0) @map("ai_importance_score")

  // 向量嵌入（已有）
  titleEmbedding    Bytes?    @map("title_embedding") @db.ByteA
  contentEmbedding  Bytes?    @map("content_embedding") @db.ByteA

  // AI分析队列（已有）
  aiAnalysisQueue   AIAnalysisQueue[]
}
```

### 2.2 新增模型设计

#### 方案 A：扩展 Entry 模型（推荐用于快速实施）

```prisma
// 在现有 Entry 基础上扩展字段
model Entry {
  // ... 保留所有现有字段 ...

  // === 新增：增强分析字段 ===
  aiOneLineSummary   String?   @map("ai_one_line_summary") // 一句话总结
  aiMainPoints       Json?     @map("ai_main_points")       // [{point, explanation}]
  aiKeyQuotes        Json?     @map("ai_key_quotes")        // [{quote, significance}]
  aiScoreDimensions  Json?     @map("ai_score_dimensions")  // 评分维度

  // 分析元数据
  aiAnalysisModel    String?   @map("ai_analysis_model")    // 使用的模型
  aiProcessingTime   Int?      @map("ai_processing_time")   // 处理耗时(ms)
  aiReflectionRounds Int       @default(0) @map("ai_reflection_rounds")

  // === 新增：个性化评分字段 ===
  personalScore      Float?    @map("personal_score")       // 个人化评分（按用户存储在关联表中）
}

// 新增：用户阅读行为表
model ReadingSession {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  entryId     String    @map("entry_id")

  // 行为数据
  startedAt   DateTime  @default(now()) @map("started_at")
  endedAt     DateTime? @map("ended_at")
  dwellTime   Int       @default(0) @map("dwell_time")      // 停留秒数
  scrollDepth Float     @default(0) @map("scroll_depth")    // 滚动深度 0-1
  isCompleted Boolean   @default(false) @map("is_completed")

  // 交互数据
  isStarred   Boolean   @default(false) @map("is_starred")
  rating      Int?      @map("rating")                      // 用户主动评分 1-5

  // 关联
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  entry       Entry     @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@unique([userId, entryId, startedAt])
  @@index([userId, createdAt])
  @@index([entryId])
  @@map("reading_sessions")
}

// 新增：用户偏好画像
model UserPreference {
  id              String   @id @default(uuid())
  userId          String   @unique @map("user_id")

  // 主题权重
  topicWeights    Json     @default("{}") @map("topic_weights")

  // 阅读偏好
  preferredDepth  String?  @map("preferred_depth")   // 'deep' | 'medium' | 'light'
  preferredLength String?  @map("preferred_length")  // 'short' | 'medium' | 'long'

  // 负反馈
  excludedTags    String[] @default([]) @map("excluded_tags")

  // 统计数据
  totalReadTime   Int      @default(0) @map("total_read_time")
  totalEntries    Int      @default(0) @map("total_entries")
  avgCompletion   Float    @default(0) @map("avg_completion")

  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("user_preferences")
}

// 新增：文章关系（知识图谱）
model ArticleRelation {
  id          String   @id @default(uuid())
  sourceId    String   @map("source_id")
  targetId    String   @map("target_id")
  relationType String  @map("relation_type") // 'similar', 'prerequisite', 'contradiction', 'extension'
  strength    Float    @default(0)           // 0-1

  sourceEntry Entry    @relation("SourceRelations", fields: [sourceId], references: [id], onDelete: Cascade)
  targetEntry Entry    @relation("TargetRelations", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([sourceId, targetId, relationType])
  @@index([sourceId, relationType])
  @@index([targetId, relationType])
  @@map("article_relations")
}

// 扩展 User 模型关联
model User {
  // ... 保留现有字段 ...

  // 新增关联
  readingSessions  ReadingSession[]
  preferences      UserPreference?
  relatedSourceEntries ArticleRelation[] @relation("SourceRelations")
  relatedTargetEntries ArticleRelation[] @relation("TargetRelations")
}

// 扩展 Entry 模型关联
model Entry {
  // ... 保留现有字段 ...

  // 新增关联
  readingSessions ReadingSession[]
  sourceRelations ArticleRelation[] @relation("SourceRelations")
  targetRelations ArticleRelation[] @relation("TargetRelations")
}
```

#### 方案 B：独立分析表（推荐用于生产环境）

```prisma
// 独立的文章分析结果表
model ArticleAnalysis {
  id                String   @id @default(uuid())
  entryId           String   @unique @map("entry_id")

  // 基础分析
  oneLineSummary    String   @map("one_line_summary") @db.Text
  summary           String   @db.Text
  mainPoints        Json     // [{point, explanation}]
  keyQuotes         Json     // [{quote, significance}]
  domain            String   // 领域
  subcategory       String   // 子分类
  tags              String[]

  // 评分系统
  aiScore           Float    @default(0) // AI客观评分(1-10)
  scoreDimensions   Json     // {depth, quality, practicality, novelty}

  // 分析元数据
  analysisModel     String   @map("analysis_model")
  processingTime    Int      @map("processing_time")
  reflectionRounds  Int      @default(0) @map("reflection_rounds")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  entry             Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([domain, aiScore])
  @@index([entryId])
  @@map("article_analyses")
}
```

**建议**：先用方案 A 快速验证核心功能，后续迁移到方案 B 以获得更好的数据管理。

### 2.3 迁移脚本

```bash
# 1. 创建迁移
npx prisma migrate dev --name add_ai_native_features

# 2. 生成 Prisma Client
npx prisma generate

# 3. 推送 schema（开发环境）
npx prisma db push
```

## 三、代码结构设计

### 3.1 新增目录结构

```
lib/ai/
├── client.ts                    # 现有 AI 服务客户端
├── queue.ts                     # 现有 AI 分析队列
│
├── workflow/                    # 新增：工作流编排
│   ├── engine.ts               # WorkflowOrchestrator
│   ├── nodes.ts                # 预定义工作流节点
│   └── types.ts                # 工作流类型定义
│
├── analysis/                    # 新增：分析引擎
│   ├── segmented-analyzer.ts   # 分段分析引擎
│   ├── reflection-engine.ts    # 反思优化引擎
│   ├── content-processor.ts    # 内容预处理
│   └── types.ts                # 分析类型定义
│
├── scoring/                     # 新增：评分系统
│   ├── personal-scorer.ts      # 个性化评分
│   ├── preference-tracker.ts   # 偏好追踪
│   └── types.ts                # 评分类型定义
│
├── embedding/                   # 新增：向量处理
│   ├── vector-store.ts         # 向量存储抽象
│   ├── pgvector-store.ts       # pgvector 实现
│   └── similarity.ts           # 相似度计算
│
├── knowledge/                   # 新增：知识图谱
│   ├── graph-builder.ts        # 图谱构建
│   ├── relation-extractor.ts   # 关系抽取
│   └── types.ts                # 图谱类型
│
└── utils/                       # 新增：工具函数
    ├── prompt.ts               # Prompt 模板
    ├── chunk.ts                # 文本分段
    └── validation.ts           # 数据验证
```

### 3.2 核心模块接口设计

#### 3.2.1 工作流引擎

```typescript
// lib/ai/workflow/types.ts

export interface WorkflowContext {
  entryId: string;
  userId?: string;
  metadata: {
    title: string;
    author?: string;
    feedName: string;
    feedUrl?: string;
  };
  content: string;
  llm: LLMProvider;
  vectorStore?: VectorStore;
  userPrefs?: UserPreference;
}

export interface WorkflowNode<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description?: string;
  execute(input: TInput, ctx: WorkflowContext): Promise<TOutput>;
  onError?(error: Error, input: TInput, ctx: WorkflowContext): Promise<TOutput | null>;
}

export interface WorkflowConfig {
  entryNode: string;
  nodes: WorkflowNode[];
  edges: Record<string, string[]>; // nodeId -> [dependencyIds]
  maxRetries?: number;
  timeout?: number;
}
```

#### 3.2.2 分析引擎

```typescript
// lib/ai/analysis/types.ts

export interface Segment {
  id: number;
  content: string;
  startIndex: number;
  endIndex: number;
  type: 'text' | 'code' | 'quote' | 'heading';
  metadata?: {
    language?: string;  // 代码块语言
    level?: number;     // 标题级别
  };
}

export interface SegmentAnalysis {
  segmentId: number;
  keyPoints: string[];
  technicalDetails?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  importance: number; // 0-1
  entities?: string[]; // 实体识别
}

export interface ArticleAnalysisResult {
  // 基础分析
  oneLineSummary: string;
  summary: string;
  mainPoints: Array<{
    point: string;
    explanation: string;
    importance: number;
  }>;
  keyQuotes?: Array<{
    quote: string;
    significance: string;
  }>;

  // 分类
  domain: string;
  subcategory: string;
  tags: string[];

  // 评分
  aiScore: number; // 1-10
  scoreDimensions: {
    depth: number;
    quality: number;
    practicality: number;
    novelty: number;
  };

  // 元数据
  analysisModel: string;
  processingTime: number;
  reflectionRounds: number;
}

export interface ReflectionResult {
  quality: number; // 0-10
  issues: string[];
  suggestions: string[];
  needsRefinement: boolean;
}
```

#### 3.2.3 评分系统

```typescript
// lib/ai/scoring/types.ts

export interface ScoringDimensions {
  depth: number;        // 内容深度 1-10
  quality: number;      // 写作质量 1-10
  practicality: number; // 实用性 1-10
  novelty: number;      // 新颖性 1-10
  relevance: number;    // 个人相关度 1-10
}

export interface PersonalizedScore {
  overall: number;           // 总分 1-10
  dimensions: ScoringDimensions;
  reasons: string[];         // 评分理由
  recommendedAction: 'read_now' | 'read_later' | 'archive' | 'skip';
  confidence: number;        // 评分置信度 0-1
}

export interface UserReadingProfile {
  userId: string;
  topicWeights: Record<string, number>; // {"Rust": 0.8, "AI": 0.9}
  preferredDepth: 'deep' | 'medium' | 'light';
  preferredLength: 'short' | 'medium' | 'long';
  excludedTags: string[];

  // 统计特征
  avgDwellTime: number;
  completionRate: number;
  diversityScore: number; // 阅读多样性

  updatedAt: Date;
}
```

## 四、tRPC 路由设计

### 4.1 扩展现有路由

```typescript
// server/api/entries.ts - 扩展

export const entriesRouter = router({
  // ... 现有方法 ...

  // 新增：触发深度分析
  triggerDeepAnalysis: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      priority: z.number().min(1).max(10).default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entryId, priority } = input;
      const userId = ctx.userId;

      // 检查文章是否存在
      const entry = await db.entry.findUnique({
        where: { id: entryId },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 检查是否已有深度分析
      const existingAnalysis = await db.articleAnalysis.findUnique({
        where: { entryId },
      });

      if (existingAnalysis) {
        return {
          status: 'already_analyzed',
          analysisId: existingAnalysis.id,
        };
      }

      // 添加到分析队列
      await addDeepAnalysisJob({
        entryId,
        userId,
        priority,
      });

      return {
        status: 'queued',
        message: '文章已加入深度分析队列',
      };
    }),

  // 新增：获取深度分析结果
  getDeepAnalysis: protectedProcedure
    .input(z.object({
      entryId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const analysis = await db.articleAnalysis.findUnique({
        where: { entryId: input.entryId },
      });

      if (!analysis) {
        return null;
      }

      // 如果有用户登录，计算实时个性化评分
      const personalScore = await calculatePersonalScore(
        analysis,
        ctx.userId
      );

      return {
        ...analysis,
        personalScore,
      };
    }),

  // 新增：批量获取分析状态
  getAnalysisStatus: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const statuses = await db.articleAnalysis.findMany({
        where: {
          entryId: { in: input.entryIds },
        },
        select: {
          entryId: true,
          createdAt: true,
          aiScore: true,
        },
      });

      const statusMap = Object.fromEntries(
        statuses.map(s => [s.entryId, s])
      );

      return statusMap;
    }),
});
```

### 4.2 新增路由

```typescript
// server/api/analytics.ts - 新增

import { router, protectedProcedure } from '../trpc/init';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUserReadingProfile } from '@/lib/ai/scoring/preference-tracker';

export const analyticsRouter = router({
  // 获取用户阅读画像
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const profile = await getUserReadingProfile(ctx.userId);
      return profile;
    }),

  // 获取个性化推荐流
  getPersonalizedFeed: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      filters: z.object({
        minScore: z.number().optional(),
        tags: z.array(z.string()).optional(),
        excludeRead: z.boolean().default(false),
      }).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { limit, cursor, filters } = input;
      const userId = ctx.userId;

      // 获取用户偏好
      const profile = await getUserReadingProfile(userId);

      // 基于偏好计算推荐
      const recommendations = await getPersonalizedRecommendations({
        userId,
        profile,
        limit,
        cursor,
        filters,
      });

      return recommendations;
    }),

  // 记录阅读行为
  trackReading: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      dwellTime: z.number().min(0), // 停留时间（秒）
      scrollDepth: z.number().min(0).max(1), // 滚动深度 0-1
      isCompleted: z.boolean(), // 是否阅读完成
      isStarred: z.boolean().optional(),
      rating: z.number().min(1).max(5).optional(),
      attentionSegments: z.array(z.object({
        startOffset: z.number(),
        endOffset: z.number(),
        duration: z.number(),
      })).optional(), // 关注段落
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;

      // 保存阅读会话
      const session = await db.readingSession.create({
        data: {
          userId,
          entryId: input.entryId,
          startedAt: new Date(Date.now() - input.dwellTime * 1000),
          endedAt: new Date(),
          dwellTime: input.dwellTime,
          scrollDepth: input.scrollDepth,
          isCompleted: input.isCompleted,
          isStarred: input.isStarred || false,
          rating: input.rating,
        },
      });

      // 异步更新用户偏好
      await updateUserPreferences(userId);

      return { sessionId: session.id };
    }),

  // 获取阅读统计
  getReadingStats: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month', 'all']).default('week'),
    }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;
      const period = input.period;

      const stats = await getReadingStatistics(userId, period);
      return stats;
    }),
});

// server/api/recommendations.ts - 新增

import { router, protectedProcedure } from '../trpc/init';
import { z } from 'zod';
import { getRelatedArticles } from '@/lib/ai/knowledge/graph-builder';

export const recommendationsRouter = router({
  // 获取相关文章
  getRelated: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      limit: z.number().min(1).max(20).default(5),
      relationType: z.enum(['similar', 'prerequisite', 'extension', 'all']).default('all'),
    }))
    .query(async ({ input }) => {
      const related = await getRelatedArticles({
        entryId: input.entryId,
        limit: input.limit,
        relationType: input.relationType,
      });

      return related;
    }),

  // 获取知识图谱数据
  getKnowledgeGraph: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      depth: z.number().min(1).max(3).default(2),
    }))
    .query(async ({ input }) => {
      const graph = await buildKnowledgeGraph({
        entryId: input.entryId,
        depth: input.depth,
      });

      return graph;
    }),
});
```

### 4.3 更新主路由

```typescript
// server/api/index.ts - 更新

import { router } from '../trpc/init';
import { authRouter } from './auth';
import { feedsRouter } from './feeds';
import { entriesRouter } from './entries'; // 已扩展
import { categoriesRouter } from './categories';
import { searchRouter } from './search';
import { reportsRouter } from './reports';
import { settingsRouter } from './settings';
import { rulesRouter } from './rules';
import { notificationsRouter } from './notifications';
import { aiRouter } from './ai';
// 新增路由
import { analyticsRouter } from './analytics';
import { recommendationsRouter } from './recommendations';

export const appRouter = router({
  auth: authRouter,
  feeds: feedsRouter,
  entries: entriesRouter,
  categories: categoriesRouter,
  search: searchRouter,
  reports: reportsRouter,
  settings: settingsRouter,
  rules: rulesRouter,
  notifications: notificationsRouter,
  ai: aiRouter,
  // 新增
  analytics: analyticsRouter,
  recommendations: recommendationsRouter,
});

export type AppRouter = typeof appRouter;
```

## 五、前端组件设计

### 5.1 AI 分析展示组件

```typescript
// components/ai/DeepAnalysisCard.tsx

'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { api } from '@/trpc/react';
import { Sparkles, TrendingUp, Clock, Award } from 'lucide-react';

interface DeepAnalysisCardProps {
  entryId: string;
}

export function DeepAnalysisCard({ entryId }: DeepAnalysisCardProps) {
  const { data: analysis, isLoading } = api.entries.getDeepAnalysis.useQuery({
    entryId,
  });

  const { mutate: triggerAnalysis } = api.entries.triggerDeepAnalysis.useMutation();

  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  if (!analysis) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-semibold">暂无深度分析</h3>
          <p className="text-sm text-muted-foreground">
            点击下方按钮启动 AI 深度分析
          </p>
          <button
            onClick={() => triggerAnalysis({ entryId })}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            开始分析
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {/* AI 评分仪表盘 */}
      <ScoreDashboard
        aiScore={analysis.aiScore}
        personalScore={analysis.personalScore}
        dimensions={analysis.scoreDimensions}
      />

      {/* 一句话总结 */}
      <OneLineSummary summary={analysis.oneLineSummary} />

      {/* 主要观点 */}
      <MainPoints points={analysis.mainPoints} />

      {/* 关键引用 */}
      {analysis.keyQuotes && analysis.keyQuotes.length > 0 && (
        <KeyQuotes quotes={analysis.keyQuotes} />
      )}

      {/* 标签云 */}
      <TagCloud tags={analysis.tags} personalRelevance={analysis.personalScore?.dimensions} />

      {/* 分析元数据 */}
      <AnalysisMetadata
        model={analysis.analysisModel}
        time={analysis.processingTime}
        rounds={analysis.reflectionRounds}
      />
    </Card>
  );
}

// 子组件
function ScoreDashboard({
  aiScore,
  personalScore,
  dimensions,
}: {
  aiScore: number;
  personalScore?: { overall: number; dimensions: any };
  dimensions: any;
}) {
  const displayScore = personalScore?.overall ?? aiScore;
  const scoreLabel = personalScore ? '个人匹配度' : 'AI 评分';

  return (
    <div className="flex items-center gap-6">
      {/* 总分仪表 */}
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${(displayScore / 10) * 251} 251`}
            className={displayScore >= 8 ? 'text-green-500' : displayScore >= 6 ? 'text-yellow-500' : 'text-red-500'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{displayScore.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <h4 className="font-semibold">{scoreLabel}</h4>

        {/* 维度进度条 */}
        {dimensions && (
          <div className="space-y-2">
            <ScoreBar label="深度" value={dimensions.depth} />
            <ScoreBar label="质量" value={dimensions.quality} />
            <ScoreBar label="实用性" value={dimensions.practicality} />
            <ScoreBar label="新颖性" value={dimensions.novelty} />
            {personalScore?.dimensions?.relevance !== undefined && (
              <ScoreBar label="相关度" value={personalScore.dimensions.relevance} />
            )}
          </div>
        )}

        {/* 推荐理由 */}
        {personalScore?.reasons && personalScore.reasons.length > 0 && (
          <div className="rounded-md bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">推荐理由：</p>
            <ul className="mt-1 text-sm text-blue-800">
              {personalScore.reasons.map((reason: string, i: number) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-sm text-muted-foreground">{label}</span>
      <Progress value={value * 10} className="flex-1" />
      <span className="w-8 text-sm text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function OneLineSummary({ summary }: { summary: string }) {
  return (
    <div className="border-l-4 border-primary bg-primary/5 pl-4 py-2">
      <p className="font-medium text-foreground">{summary}</p>
    </div>
  );
}

function MainPoints({ points }: { points: Array<{ point: string; explanation: string; importance: number }> }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="points">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            主要观点 ({points.length})
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="space-y-3">
            {points.map((item, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full ${
                    item.importance > 0.8 ? 'bg-green-500' :
                    item.importance > 0.5 ? 'bg-yellow-500' : 'bg-gray-500'
                  }`} />
                  <span className="font-medium">{item.point}</span>
                </div>
                {item.explanation && (
                  <p className="ml-4 text-sm text-muted-foreground">{item.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function KeyQuotes({ quotes }: { quotes: Array<{ quote: string; significance: string }> }) {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 font-semibold">
        <Award className="h-4 w-4" />
        关键引用
      </h4>
      <div className="space-y-2">
        {quotes.map((quote, i) => (
          <blockquote key={i} className="border-l-4 border-muted-foreground/30 bg-muted/50 pl-4 py-2">
            <p className="italic text-foreground">"{quote.quote}"</p>
            {quote.significance && (
              <p className="mt-1 text-sm text-muted-foreground">— {quote.significance}</p>
            )}
          </blockquote>
        ))}
      </div>
    </div>
  );
}

function TagCloud({
  tags,
  personalRelevance,
}: {
  tags: string[];
  personalRelevance?: { relevance: number };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(tag => {
        const isHighRelevance = personalRelevance?.relevance > 7;
        return (
          <Badge
            key={tag}
            variant={isHighRelevance ? 'default' : 'secondary'}
            className={isHighRelevance ? 'bg-primary' : ''}
          >
            {tag}
          </Badge>
        );
      })}
    </div>
  );
}

function AnalysisMetadata({
  model,
  time,
  rounds,
}: {
  model: string;
  time: number;
  rounds: number;
}) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {Math.round(time / 1000)}s
      </span>
      <span>{model}</span>
      {rounds > 0 && (
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {rounds} 轮优化
        </span>
      )}
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
    </Card>
  );
}
```

### 5.2 阅读行为追踪 Hook

```typescript
// hooks/useReadingTracking.ts

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/trpc/react';

interface ReadingTrackingOptions {
  entryId: string;
  enabled?: boolean;
  reportInterval?: number; // 上报间隔（毫秒）
  minDwellTime?: number; // 最小停留时间（秒）
}

export function useReadingTracking({
  entryId,
  enabled = true,
  reportInterval = 10000,
  minDwellTime = 3,
}: ReadingTrackingOptions) {
  const [isActive, setIsActive] = useState(false);
  const startTimeRef = useRef<Date | null>(null);
  const maxScrollRef = useRef(0);
  const reportTimerRef = useRef<NodeJS.Timeout>();

  const { mutate: trackReading } = api.analytics.trackReading.useMutation();

  // 初始化阅读会话
  useEffect(() => {
    if (!enabled) return;

    const handleStart = () => {
      if (!isActive) {
        setIsActive(true);
        startTimeRef.current = new Date();
      }
    };

    // 监听用户交互
    document.addEventListener('scroll', handleStart, { once: true, passive: true });
    document.addEventListener('keydown', handleStart, { once: true });

    return () => {
      document.removeEventListener('scroll', handleStart);
      document.removeEventListener('keydown', handleStart);
    };
  }, [enabled, isActive]);

  // 追踪滚动深度
  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const depth = scrollHeight > 0 ? scrolled / scrollHeight : 0;
      maxScrollRef.current = Math.max(maxScrollRef.current, depth);
    };

    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => document.removeEventListener('scroll', handleScroll);
  }, [enabled]);

  // 定期上报
  useEffect(() => {
    if (!enabled || !isActive) return;

    reportTimerRef.current = setInterval(() => {
      reportProgress(false);
    }, reportInterval);

    return () => {
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current);
      }
    };
  }, [enabled, isActive, reportInterval]);

  // 页面卸载时最终上报
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      reportProgress(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  const reportProgress = (isCompleted: boolean) => {
    if (!startTimeRef.current) return;

    const now = new Date();
    const dwellTime = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);

    // 过滤掉停留时间过短的记录
    if (dwellTime < minDwellTime && !isCompleted) return;

    trackReading({
      entryId,
      dwellTime,
      scrollDepth: maxScrollRef.current,
      isCompleted,
    });
  };

  return {
    isActive,
    scrollDepth: maxScrollRef.current,
  };
}
```

### 5.3 个性化推荐流组件

```typescript
// components/feeds/PersonalizedFeed.tsx

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/trpc/react';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EntryCard } from './EntryCard';

export function PersonalizedFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
  } = api.analytics.getPersonalizedFeed.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const entries = data?.pages.flatMap(page => page.entries) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">为你推荐</h2>
        <span className="text-sm text-muted-foreground">
          基于 AI 个性化算法
        </span>
      </div>

      <div className="space-y-4">
        {entries.map(entry => (
          <EntryCard
            key={entry.id}
            entry={entry}
            showPersonalScore
            showRecommendedAction
          />
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetching}
          className="w-full rounded-md border py-2 text-sm"
        >
          {isFetching ? '加载中...' : '加载更多'}
        </button>
      )}
    </div>
  );
}
```

## 六、实施路线图

### Phase 1：基础设施（Week 1）

**目标**：建立数据基础和核心 AI 引擎

| 任务 | 文件 | 优先级 |
|------|------|--------|
| 数据库迁移 | `prisma/schema.prisma` | P0 |
| 类型定义 | `lib/ai/**/types.ts` | P0 |
| 工作流引擎 | `lib/ai/workflow/` | P0 |
| 分段分析 | `lib/ai/analysis/segmented-analyzer.ts` | P0 |

**验收标准**：
- [ ] 数据库迁移成功，新表创建
- [ ] 工作流引擎能执行基本的节点依赖图
- [ ] 分段分析能正确处理 Markdown 格式文章
- [ ] 单元测试覆盖率 > 70%

### Phase 2：核心 AI 能力（Week 2-3）

**目标**：实现深度分析和反思机制

| 任务 | 文件 | 优先级 |
|------|------|--------|
| 反思引擎 | `lib/ai/analysis/reflection-engine.ts` | P0 |
| 评分系统 | `lib/ai/scoring/` | P0 |
| 队列集成 | `lib/queue/deep-analysis-processor.ts` | P0 |
| tRPC 路由 | `server/api/entries.ts` | P0 |

**验收标准**：
- [ ] 反思引擎能识别并修复分析质量问题
- [ ] 评分系统能输出多维度的 AI 评分
- [ ] BullMQ 队列能正确处理深度分析任务
- [ ] API 能触发分析并返回结果

### Phase 3：个性化功能（Week 4）

**目标**：实现用户行为追踪和个性化评分

| 任务 | 文件 | 优先级 |
|------|------|--------|
| 行为追踪 Hook | `hooks/useReadingTracking.ts` | P0 |
| 偏好追踪器 | `lib/ai/scoring/preference-tracker.ts` | P0 |
| 个性化评分 | `lib/ai/scoring/personal-scorer.ts` | P0 |
| 推荐算法 | `lib/ai/recommendations/` | P1 |

**验收标准**：
- [ ] 前端能正确追踪用户阅读行为
- [ ] 用户偏好能根据行为自动更新
- [ ] 个性化评分能反映用户兴趣
- [ ] 推荐流比时间排序有更高的点击率

### Phase 4：高级功能（Week 5-6）

**目标**：知识图谱和高级推荐

| 任务 | 文件 | 优先级 |
|------|------|--------|
| 向量存储 | `lib/ai/embedding/pgvector-store.ts` | P1 |
| 关系抽取 | `lib/ai/knowledge/relation-extractor.ts` | P2 |
| 知识图谱 | `lib/ai/knowledge/graph-builder.ts` | P2 |
| 前端可视化 | `components/knowledge/GraphVisualization.tsx` | P2 |

**验收标准**：
- [ ] 文章向量化并存储到 pgvector
- [ ] 能基于向量相似度找到相关文章
- [ ] 知识图谱能正确展示文章关系
- [ ] 前端图谱可视化组件正常工作

### Phase 5：优化与部署（Week 7-8）

**目标**：性能优化和生产准备

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 性能优化 | 减少冗余 API 调用，优化 Prompt | P0 |
| 成本优化 | 智能选择模型，缓存策略 | P0 |
| 监控告警 | AI 分析失败率、处理时长 | P1 |
| 文档完善 | API 文档、部署指南 | P1 |

## 七、技术决策记录

### 7.1 为什么选择方案 A（扩展 Entry）而非方案 B（独立表）？

| 维度 | 方案 A | 方案 B |
|------|--------|--------|
| 实施速度 | 快 | 慢 |
| 查询性能 | 好（单表查询） | 差（需要 JOIN） |
| 数据管理 | 混乱 | 清晰 |
| 扩展性 | 差 | 好 |
| 适用场景 | MVP | 生产环境 |

**决策**：先用方案 A 快速验证，后续逐步迁移到方案 B。

### 7.2 为什么选择代码级工作流而非 Dify？

| 维度 | Dify | 代码级工作流 |
|------|------|--------------|
| 开发速度 | 快（可视化） | 慢（需编码） |
| 性能 | 差（HTTP 调用） | 好（内存级） |
| 灵活性 | 受限 | 无限 |
| 调试 | 困难 | 容易 |
| 成本 | 高 | 低 |

**决策**：选择代码级工作流，长期来看更优。

### 7.3 多模型策略

| 任务阶段 | 模型选择 | 理由 |
|----------|----------|------|
| 内容分段 | 无需 LLM | 基于规则 |
| 分段分析 | DeepSeek-Chat | 高性价比，中文优秀 |
| 结果聚合 | GPT-4o-mini | 平衡质量和成本 |
| 质量反思 | GPT-4o / Claude-3.5-Sonnet | 最高质量 |
| 向量嵌入 | OpenAI text-embedding-3-small | 便宜够用 |

## 八、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| AI 成本过高 | 高 | 中 | 多模型策略 + 缓存 |
| 分析质量不稳定 | 高 | 中 | 反思机制 + 人工抽检 |
| 性能瓶颈 | 中 | 低 | 队列 + 缓存 + 分页 |
| 用户隐私 | 中 | 低 | 数据脱敏 + 本地部署选项 |

## 九、下一步行动

1. **确认方案**：与团队确认数据库迁移方案和技术选型
2. **环境准备**：确保 pgvector 扩展已安装
3. **开始 Phase 1**：创建第一个 Pull Request - 数据库迁移

---

**文档版本**: v1.0
**最后更新**: 2025-01-XX
**维护者**: Claude Code
