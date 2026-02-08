# AI-Native 完整数据流程说明

## 📊 总体流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RSS 到 AI 分析完整流程                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  1. RSS抓取  │ ──▶ │  2. 文章解析  │ ──▶ │  3. 数据存储  │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ FeedManager  │     │ RSS Parser   │     │ Prisma ORM   │
  │              │     │ + Cheerio    │     │ + PostgreSQL │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                                      │
                                      ▼
                            ┌──────────────┐
                            │  4. 基础AI    │
                            │     分析     │
                            └──────────────┘
                                      │
                                      ▼
                            ┌──────────────┐
                            │ 5. 深度分析  │
                            │    队列入队  │
                            └──────────────┘
                                      │
                                      ▼
                            ┌──────────────┐
                            │ 6. BullMQ    │
                            │    Worker    │
                            └──────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ 7. 分段分析  │ │ 8. 反思优化  │ │ 9. 个性化    │
            │  (Map-Reduce)│ │  (多轮迭代)  │ │    评分      │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
                            ┌──────────────┐
                            │ 10. 结果存储 │
                            └──────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ 11. 向量存储 │ │ 12. 知识图谱 │ │ 13. 用户偏好 │
            │              │ │    构建      │ │    学习      │
            └──────────────┘ └──────────────┘ └──────────────┘
                                      │
                                      ▼
                            ┌──────────────┐
                            │ 14. 前端展示 │
                            │    + 推荐    │
                            └──────────────┘
```

---

## 📝 阶段详解

### 阶段 1: RSS 抓取 (Feed Fetching)

**入口**: `app/api/scheduler/trigger/route.ts` (定时任务或手动触发)

**核心文件**: `lib/rss/feed-manager.ts`

```typescript
// 抓取流程
async function fetchFeeds() {
  // 1. 获取所有活跃的订阅源
  const feeds = await db.feed.findMany({
    where: { active: true },
    orderBy: { priority: 'asc' }  // 按优先级排序
  });

  // 2. 批量抓取（支持并发控制）
  const results = await Promise.allSettled(
    feeds.map(feed => fetchSingleFeed(feed))
  );

  // 3. 处理结果和错误
  return processResults(results);
}
```

**关键特性**:
- 支持 HTTP 缓存 (ETag, Last-Modified)
- 自动重试（指数退避）
- 优先级调度
- 错误监控

**环境变量**:
```env
FETCH_TIMEOUT=30000       # 请求超时
MAX_CONCURRENT_FETCHES=5  # 并发数
```

---

### 阶段 2: 文章解析 (Parsing)

**核心文件**: `lib/rss/parser.ts`

```typescript
// 解析流程
async function parseFeed(xmlContent: string) {
  // 1. 解析 XML/Atom/JSON Feed
  const feed = await parser.parseString(xmlContent);

  // 2. 提取文章列表
  const items = feed.items.map(item => ({
    title: item.title,
    link: item.link,
    content: item.content || item.description,
    publishedAt: item.pubDate,
    author: item.creator,
    // ...更多字段
  }));

  // 3. 内容提取（针对不完整的内容）
  const enriched = await extractFullContent(items);

  return enriched;
}
```

**内容提取** (`lib/rss/content-extractor.ts`):
- 使用 Cheerio 解析 HTML
- 移除广告、导航等无关内容
- 提取正文文本
- 保留基本格式

---

### 阶段 3: 数据存储 (Storage)

**核心文件**: `lib/db.ts` (Prisma Client)

```typescript
// 存储流程
async function saveEntries(entries: Entry[]) {
  // 1. 计算内容哈希（用于去重）
  const withHash = entries.map(entry => ({
    ...entry,
    contentHash: hashContent(entry.title + entry.content)
  }));

  // 2. 批量插入（自动去重）
  const created = await db.entry.createMany({
    data: withHash,
    skipDuplicates: true  // 跳过重复的内容
  });

  // 3. 更新订阅源统计
  await updateFeedStats(feedId, created.count);
}
```

**数据库模型** (`prisma/schema.prisma`):
```prisma
model Entry {
  id          String   @id @default(uuid())
  title       String
  url         String   @unique
  content     String?  @db.Text

  // 去重字段
  contentHash String   @unique @map("content_hash")

  // 关联
  feedId      String
  feed        Feed     @relation(fields: [feedId], references: [id])

  // AI 分析字段
  aiSummary   String?  @map("ai_summary")
  aiKeywords  Json?    @map("ai_keywords")
  // ... 更多 AI 字段

  createdAt   DateTime @default(now())
}
```

---

### 阶段 4: 基础 AI 分析 (Basic AI Analysis)

**核心文件**: `lib/ai/client.ts` + `lib/ai/queue.ts`

```typescript
// 基础分析流程
async function basicAnalysis(entryId: string) {
  // 1. 获取文章内容
  const entry = await db.entry.findUnique({ where: { id: entryId } });

  // 2. 调用 AI 服务
  const aiService = getDefaultAIService();
  const result = await aiService.analyzeArticle(entry.content, {
    summary: true,      // 生成摘要
    keywords: true,     // 提取关键词
    category: true,     // 分类
    sentiment: true,    // 情感分析
    importance: true,   // 重要性评分
  });

  // 3. 存储结果
  await db.entry.update({
    where: { id: entryId },
    data: {
      aiSummary: result.summary,
      aiKeywords: result.keywords,
      aiCategory: result.category,
      aiSentiment: result.sentiment,
      aiImportanceScore: result.importanceScore,
    }
  });
}
```

**队列处理** (`lib/ai/queue.ts`):
- 使用 BullMQ 队列
- 异步处理，避免阻塞
- 失败自动重试

---

### 阶段 5: 深度分析入队 (Deep Analysis Queue)

**API 路由**: `server/api/entries.ts`

```typescript
// 触发深度分析
async function triggerDeepAnalysis(entryId: string, priority: number) {
  // 1. 检查是否已分析
  const existing = await db.entry.findUnique({
    where: { id: entryId },
    select: { aiAnalyzedAt: true }
  });

  if (existing?.aiAnalyzedAt) {
    return { status: 'already_analyzed' };
  }

  // 2. 添加到队列
  const jobId = await addDeepAnalysisJob({
    entryId,
    userId: ctx.userId,
    priority,
  });

  return { status: 'queued', jobId };
}
```

**队列配置** (`lib/queue/deep-analysis-processor.ts`):
```typescript
const queue = new Queue('deep-analysis', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,           // 重试 3 次
    backoff: 'exponential', // 指数退避
    removeOnComplete: 100,  // 保留最近 100 个成功任务
    removeOnFail: 500,      // 保留最近 500 个失败任务
  }
});
```

---

### 阶段 6: BullMQ Worker 处理 (Queue Worker)

**核心文件**: `lib/queue/deep-analysis-processor.ts`

```typescript
// Worker 启动
const worker = new Worker(
  'deep-analysis',
  async (job) => {
    const { entryId, userId } = job.data;

    try {
      // 1. 获取文章内容
      const entry = await getEntryWithContent(entryId);

      // 2. 初始化工作流引擎
      const orchestrator = new WorkflowOrchestrator(llmService);

      // 3. 执行分析工作流
      const result = await orchestrator.execute(
        'deep-analysis',
        { content: entry.content, metadata: entry },
        { entryId, userId }
      );

      // 4. 存储结果
      await saveAnalysisResult(entryId, result);

      return result;
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  },
  { connection: redis }
);
```

---

### 阶段 7: 分段分析 (Segmented Analysis - Map)

**核心文件**: `lib/ai/analysis/segmented-analyzer.ts`

```typescript
// 分段分析流程
class SegmentedAnalyzer {
  async analyze(content: string, metadata: any) {
    // 1. 智能分段（保持语义完整性）
    const segments = this.segment(content);
    // 结果: [
    //   { id: 1, content: "...", overlap: "..." },
    //   { id: 2, content: "...", overlap: "..." },
    //   ...
    // ]

    // 2. 并行分析（Map 阶段）
    const analyzedSegments = await this.analyzeSegments(segments, metadata);
    // 并发调用 LLM 分析每个段落

    // 3. 聚合结果（Reduce 阶段）
    const aggregated = await this.aggregate(analyzedSegments);
    // 合并、去重、整理

    return aggregated;
  }

  private segment(content: string): Segment[] {
    // 1. Markdown 分词（marked 库）
    const tokens = marked.lexer(content);

    // 2. 按段落/标题分组
    const segments = [];
    let currentSegment = [];
    let tokenCount = 0;

    for (const token of tokens) {
      currentSegment.push(token);
      tokenCount += this.countTokens(token);

      // 达到阈值时切分（约 2000 tokens）
      if (tokenCount >= 2000) {
        segments.push(this.wrapSegment(currentSegment));
        // 保留重叠部分（约 200 tokens）避免上下文丢失
        currentSegment = this.keepOverlap(currentSegment);
        tokenCount = this.countTokens(currentSegment);
      }
    }

    return segments;
  }
}
```

**输出示例**:
```json
{
  "oneLineSummary": "这篇文章探讨了...",
  "summary": "详细摘要...",
  "mainPoints": [
    {
      "point": "核心观点1",
      "explanation": "详细解释...",
      "importance": 9
    }
  ],
  "keyQuotes": [
    {
      "quote": "引用文本...",
      "significance": "重要性说明..."
    }
  ]
}
```

---

### 阶段 8: 反思优化 (Reflection Engine)

**核心文件**: `lib/ai/analysis/reflection-engine.ts`

```typescript
// 反思优化流程
class ReflectionEngine {
  async refine(originalContent: string, analysis: any, maxRounds: number = 3) {
    let currentAnalysis = analysis;
    let qualityScore = 0;

    for (let round = 0; round < maxRounds; round++) {
      // 1. 质量评估（5 维度）
      const assessment = await this.assessQuality(originalContent, currentAnalysis);
      /*
      {
        "comprehensiveness": 8,  // 全面性
        "accuracy": 9,           // 准确性
        "depth": 7,              // 深度性
        "consistency": 10,       // 一致性
        "objectivity": 8,        // 客观性
        "overall": 8.4
      }
      */

      qualityScore = assessment.overall;

      // 2. 质量达标则退出
      if (qualityScore >= 8.5) {
        break;
      }

      // 3. 生成改进建议
      const improvements = await this.generateImprovements(originalContent, currentAnalysis, assessment);
      /*
      {
        "issues": ["摘要缺少关键点X", "重要性评分偏低"],
        "suggestions": ["补充X观点", "提高评分"]
      }
      */

      // 4. 应用改进
      currentAnalysis = await this.applyImprovements(currentAnalysis, improvements);
    }

    return {
      ...currentAnalysis,
      qualityScore,
      reflectionRounds: maxRounds
    };
  }

  private async assessQuality(content: string, analysis: any) {
    const prompt = `
      评估以下分析的质量（1-10分）：

      原文摘要：${content.slice(0, 1000)}...

      分析结果：
      ${JSON.stringify(analysis, null, 2)}

      评估维度：
      1. 全面性：是否覆盖所有关键要点
      2. 准确性：是否准确反映原文观点
      3. 深度性：分析是否有足够深度
      4. 一致性：内部逻辑是否一致
      5. 客观性：是否保持客观中立

      请返回 JSON 格式的评分。
    `;

    return await this.llm.generate(prompt);
  }
}
```

---

### 阶段 9: 个性化评分 (Personalized Scoring)

**核心文件**: `lib/ai/scoring/personal-scorer.ts`

```typescript
// 个性化评分流程
class PersonalScorer {
  async calculateScore(analysis: any, userPrefs: UserPreference) {
    // 1. 基础评分（客观质量）
    const baseScore = (
      analysis.scoreDimensions.depth * 0.25 +
      analysis.scoreDimensions.quality * 0.25 +
      analysis.scoreDimensions.practicality * 0.25 +
      analysis.scoreDimensions.novelty * 0.25
    );

    // 2. 个性化因子
    const personalFactors = await this.calculatePersonalFactors(analysis, userPrefs);
    /*
    {
      "topicMatch": 0.8,      // 主题匹配度
      "depthMatch": 0.9,      // 深度偏好匹配
      "lengthMatch": 1.0,     // 长度偏好匹配
      "recencyBoost": 1.1,    // 新鲜度加成
      "diversityBonus": 0.05  // 多样性奖励
    }
    */

    // 3. 计算最终评分
    const personalScore = baseScore * personalFactors.composite;

    return {
      personalScore: Math.min(10, Math.max(1, personalScore)),
      factors: personalFactors,
      breakdown: {
        baseScore,
        personalAdjustment: personalScore - baseScore
      }
    };
  }

  private async calculatePersonalFactors(analysis: any, userPrefs: UserPreference) {
    const factors = {
      topicMatch: 0.5,      // 默认值
      depthMatch: 1.0,
      lengthMatch: 1.0,
      recencyBoost: 1.0,
      diversityBonus: 0
    };

    // 主题匹配度
    if (analysis.keywords && userPrefs.topicWeights) {
      const matchedTopics = analysis.keywords.filter(k => userPrefs.topicWeights[k]);
      if (matchedTopics.length > 0) {
        const avgWeight = matchedTopics.reduce((sum, k) =>
          sum + (userPrefs.topicWeights[k] || 0), 0) / matchedTopics.length;
        factors.topicMatch = Math.min(1.5, avgWeight);
      }
    }

    // 深度偏好匹配
    const preferredDepth = userPrefs.preferredDepth; // 'deep' | 'medium' | 'light'
    const analysisDepth = analysis.scoreDimensions?.depth || 5;

    if (preferredDepth === 'deep' && analysisDepth >= 8) {
      factors.depthMatch = 1.2;
    } else if (preferredDepth === 'light' && analysisDepth <= 6) {
      factors.depthMatch = 1.1;
    }

    // 长度偏好匹配
    const contentLength = analysis.contentLength || 0;
    const preferredLength = userPrefs.preferredLength;

    if (preferredLength === 'short' && contentLength < 2000) {
      factors.lengthMatch = 1.1;
    } else if (preferredLength === 'long' && contentLength > 5000) {
      factors.lengthMatch = 1.1;
    }

    // 新鲜度加成（7天内）
    const publishedAt = new Date(analysis.publishedAt);
    const daysSince = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      factors.recencyBoost = 1.1;
    }

    return {
      ...factors,
      composite: factors.topicMatch * factors.depthMatch *
                 factors.lengthMatch * factors.recencyBoost +
                 factors.diversityBonus
    };
  }
}
```

---

### 阶段 10: 结果存储 (Result Storage)

**核心文件**: `lib/queue/deep-analysis-processor.ts`

```typescript
// 存储分析结果
async function saveAnalysisResult(entryId: string, result: AnalysisResult) {
  // 1. 更新 Entry 表
  await db.entry.update({
    where: { id: entryId },
    data: {
      aiOneLineSummary: result.oneLineSummary,
      aiMainPoints: result.mainPoints,
      aiKeyQuotes: result.keyQuotes,
      aiScoreDimensions: result.scoreDimensions,
      aiScore: result.aiScore,
      aiAnalysisModel: result.model,
      aiProcessingTime: result.processingTime,
      aiReflectionRounds: result.reflectionRounds,
      aiAnalyzedAt: new Date(),
    }
  });

  // 2. 存储向量（用于语义搜索）
  if (result.embedding) {
    await vectorStore.store(entryId, result.embedding, {
      category: result.category,
      keywords: result.keywords,
      summary: result.summary
    });
  }

  // 3. 发送通知（可选）
  await notifyAnalysisComplete(entryId);
}
```

---

### 阶段 11: 向量存储 (Vector Storage)

**核心文件**: `lib/ai/embedding/pgvector-store.ts` 或 `memory-vector-store.ts`

```typescript
// 向量存储流程
class PgVectorStore {
  async store(id: string, vector: number[], metadata: any) {
    // 1. 将数组转换为 pgvector 格式
    const vectorString = `[${vector.join(',')}]`;

    // 2. 插入数据库
    await db.$executeRaw`
      INSERT INTO embeddings (id, entry_id, vector, metadata, created_at)
      VALUES (${randomUUID()}, ${id}, ${vectorString}::vector, ${JSON.stringify(metadata)}, NOW())
      ON CONFLICT (entry_id) DO UPDATE SET
        vector = ${vectorString}::vector,
        metadata = ${JSON.stringify(metadata)},
        updated_at = NOW()
    `;
  }

  async search(queryVector: number[], limit: number, threshold: number) {
    const vectorString = `[${queryVector.join(',')}]`;

    // 余弦相似度搜索
    const results = await db.$queryRaw`
      SELECT
        entry_id,
        metadata,
        1 - (vector <=> ${vectorString}::vector) as similarity
      FROM embeddings
      WHERE 1 - (vector <=> ${vectorString}::vector) > ${threshold}
      ORDER BY vector <=> ${vectorString}::vector
      LIMIT ${limit}
    `;

    return results.map(r => ({
      entryId: r.entry_id,
      metadata: r.metadata,
      similarity: r.similarity
    }));
  }
}
```

---

### 阶段 12: 知识图谱构建 (Knowledge Graph)

**核心文件**: `lib/ai/knowledge/relation-extractor.ts`

```typescript
// 关系抽取流程
class RelationExtractor {
  async findRelatedArticles(entryId: string, options: FindOptions) {
    const { limit = 5, relationType = 'all', minSimilarity = 0.75 } = options;

    // 1. 获取目标文章
    const targetEntry = await db.entry.findUnique({
      where: { id: entryId },
      include: { aiAnalysis: true }
    });

    // 2. 向量搜索相似文章
    const similar = await vectorStore.search(
      targetEntry.contentEmbedding,
      limit * 3,
      minSimilarity
    );

    // 3. 深度分析关系类型
    const relations = await Promise.all(
      similar.map(async (item) => {
        const relation = await this.analyzeRelation(targetEntry, item.entry);
        return {
          entryId: item.entry.id,
          relationType: relation.type,  // similar/prerequisite/extension/contradiction
          strength: relation.strength,  // 0-1
          reason: relation.reason
        };
      })
    );

    // 4. 过滤和排序
    const filtered = relations
      .filter(r => relationType === 'all' || r.relationType === relationType)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);

    // 5. 存储关系
    await this.storeRelations(entryId, filtered);

    return filtered;
  }

  private async analyzeRelation(entry1: any, entry2: any) {
    const prompt = `
      分析以下两篇文章之间的关系：

      文章A：${entry1.title}
      摘要：${entry1.aiOneLineSummary}
      关键词：${entry1.aiKeywords?.join(', ')}

      文章B：${entry2.title}
      摘要：${entry2.aiOneLineSummary}
      关键词：${entry2.aiKeywords?.join(', ')}

      请判断关系类型（选择最相关的一个）：
      1. similar - 内容相似，讨论同一话题
      2. prerequisite - B是A的前置知识，建议先读B
      3. extension - B是A的扩展阅读，相关主题深入
      4. contradiction - 观点相反或对立

      返回JSON格式：
      {
        "type": "similar",
        "strength": 0.85,
        "reason": "两篇文章都讨论了..."
      }
    `;

    return await this.llm.generate(prompt);
  }

  async buildKnowledgeGraph(entryId: string, depth: number = 2) {
    const nodes = new Map();
    const edges = [];
    const visited = new Set();

    // BFS 构建图谱
    const queue = [{ id: entryId, layer: 0 }];
    nodes.set(entryId, { id: entryId, layer: 0 });

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current.id) || current.layer >= depth) continue;

      visited.add(current.id);

      // 查找相关文章
      const related = await this.findRelatedArticles(current.id, {
        limit: 5,
        minSimilarity: 0.7
      });

      for (const rel of related) {
        const targetId = rel.entryId;

        // 添加节点
        if (!nodes.has(targetId)) {
          nodes.set(targetId, {
            id: targetId,
            layer: current.layer + 1
          });
          queue.push({ id: targetId, layer: current.layer + 1 });
        }

        // 添加边
        edges.push({
          source: current.id,
          target: targetId,
          label: rel.relationType,
          strength: rel.strength
        });
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
      stats: {
        totalNodes: nodes.size,
        totalEdges: edges.length
      }
    };
  }
}
```

---

### 阶段 13: 用户偏好学习 (Preference Learning)

**核心文件**: `lib/ai/scoring/preference-tracker.ts`

```typescript
// 偏好学习流程
async function updateUserPreferences(userId: string) {
  // 1. 获取最近的阅读历史（最近 100 条）
  const history = await db.readingSession.findMany({
    where: { userId },
    include: {
      entry: {
        include: {
          feed: true,
          aiAnalysis: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  if (history.length < 5) {
    return; // 数据不足
  }

  // 2. 分析主题偏好
  const topicWeights = {};
  for (const session of history) {
    const keywords = session.entry.aiAnalysis?.keywords || [];
    const engagement = calculateEngagement(session); // 基于完成率、停留时间

    for (const keyword of keywords) {
      if (!topicWeights[keyword]) {
        topicWeights[keyword] = 0;
      }
      topicWeights[keyword] += engagement;
    }
  }

  // 归一化
  const maxWeight = Math.max(...Object.values(topicWeights));
  const normalizedWeights = {};
  for (const [topic, weight] of Object.entries(topicWeights)) {
    normalizedWeights[topic] = weight / maxWeight;
  }

  // 3. 分析阅读偏好
  const completedSessions = history.filter(h => h.isCompleted);
  const avgDwellTime = history.reduce((sum, h) => sum + h.dwellTime, 0) / history.length;
  const avgCompletion = history.reduce((sum, h) => sum + h.scrollDepth, 0) / history.length;

  let preferredDepth = 'medium';
  if (avgCompletion > 0.8 && avgDwellTime > 300) {
    preferredDepth = 'deep';
  } else if (avgCompletion < 0.3 || avgDwellTime < 60) {
    preferredDepth = 'light';
  }

  // 4. 检测负反馈
  const excludedTags = [];
  const quickSkips = history.filter(h => h.dwellTime < 30 && h.scrollDepth < 0.3);
  for (const session of quickSkips) {
    const tags = session.entry.aiAnalysis?.keywords || [];
    excludedTags.push(...tags);
  }

  // 5. 计算多样性分数
  const uniqueTopics = new Set();
  for (const session of history) {
    const keywords = session.entry.aiAnalysis?.keywords || [];
    keywords.forEach(k => uniqueTopics.add(k));
  }
  const diversityScore = uniqueTopics.size / Math.max(history.length, 1);

  // 6. 更新用户偏好
  await db.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      topicWeights: normalizedWeights,
      preferredDepth,
      excludedTags: [...new Set(excludedTags)],
      stats: {
        totalEntries: history.length,
        avgCompletion,
        avgDwellTime,
        diversityScore
      }
    },
    update: {
      topicWeights: normalizedWeights,
      preferredDepth,
      excludedTags: [...new Set(excludedTags)],
      stats: {
        totalEntries: history.length,
        avgCompletion,
        avgDwellTime,
        diversityScore
      }
    }
  });
}
```

---

### 阶段 14: 前端展示和推荐 (Frontend Display)

**核心组件**:

1. **阅读行为追踪** (`hooks/useReadingTracking.ts`):
```typescript
function useReadingTracking({ entryId, enabled }) {
  const [scrollDepth, setScrollDepth] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const startTime = useRef<Date>();

  useEffect(() => {
    if (!enabled) return;

    // 开始追踪
    startTime.current = new Date();
    setIsActive(true);

    // 监听滚动
    const handleScroll = () => {
      const depth = calculateScrollDepth();
      setScrollDepth(depth);
    };
    window.addEventListener('scroll', handleScroll);

    // 定期上报（每30秒）
    const interval = setInterval(() => {
      if (scrollDepth >= 0.1) {
        trackReading({
          entryId,
          dwellTime: Math.floor((Date.now() - startTime.current.getTime()) / 1000),
          scrollDepth,
          isCompleted: scrollDepth >= 0.9
        });
      }
    }, 30000);

    // 页面卸载时上报
    const handleBeforeUnload = () => {
      trackReading({
        entryId,
        dwellTime: Math.floor((Date.now() - startTime.current.getTime()) / 1000),
        scrollDepth,
        isCompleted: scrollDepth >= 0.9
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [entryId, enabled]);

  return { scrollDepth, isActive };
}
```

2. **深度分析卡片** (`components/ai/DeepAnalysisCard.tsx`):
```typescript
function DeepAnalysisCard({ entryId }) {
  const { data: analysis, isLoading } = api.entries.getDeepAnalysis.useQuery({
    entryId
  });

  if (isLoading) return <LoadingSpinner />;
  if (!analysis) return null;

  return (
    <Card>
      <h3>AI 分析</h3>

      {/* 评分仪表盘 */}
      <ScoreDashboard score={analysis.aiScore} />

      {/* 一句话总结 */}
      <p>{analysis.oneLineSummary}</p>

      {/* 主要观点 */}
      <MainPoints points={analysis.mainPoints} />

      {/* 关键引用 */}
      <KeyQuotes quotes={analysis.keyQuotes} />

      {/* 维度评分 */}
      <DimensionScores dimensions={analysis.scoreDimensions} />
    </Card>
  );
}
```

3. **个性化推荐流** (`components/feeds/PersonalizedFeed.tsx`):
```typescript
function PersonalizedFeed({ limit = 20 }) {
  const { data, fetchNextPage, hasNextPage } =
    api.analytics.getPersonalizedFeed.useInfiniteQuery(
      { limit, filters: { minScore: 6 } },
      { getNextPageParam: lastPage => lastPage.pagination.nextCursor }
    );

  const entries = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <div>
      {entries.map(entry => (
        <PersonalizedEntryCard
          key={entry.id}
          entry={entry}
          personalScore={entry.personalScore}
        />
      ))}
      {hasNextPage && <Button onClick={fetchNextPage}>加载更多</Button>}
    </div>
  );
}
```

4. **知识图谱可视化** (`components/knowledge/KnowledgeGraph.tsx`):
```typescript
function KnowledgeGraph({ entryId, depth = 2 }) {
  const { data: graph } = api.recommendations.getKnowledgeGraph.useQuery({
    entryId,
    depth
  });

  if (!graph) return null;

  return (
    <Card>
      <svg>
        {/* 绘制节点 */}
        {graph.nodes.map(node => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={25} />
            <text>{node.title}</text>
          </g>
        ))}
        {/* 绘制边 */}
        {graph.edges.map(edge => (
          <line
            x1={edge.sourceX}
            y1={edge.sourceY}
            x2={edge.targetX}
            y2={edge.targetY}
            stroke={getEdgeColor(edge.label)}
          />
        ))}
      </svg>
    </Card>
  );
}
```

---

## ⏱️ 时间估算

| 阶段 | 耗时 | 说明 |
|------|------|------|
| RSS 抓取 | 1-5秒/源 | 取决于源响应速度 |
| 文章解析 | 0.5-2秒/篇 | 内容提取耗时 |
| 基础 AI 分析 | 5-15秒/篇 | 使用快速模型 |
| 深度分析 | 30-60秒/篇 | 包含反思和评分 |
| 向量存储 | 1-2秒/篇 | pgvector 插入 |
| 知识图谱构建 | 10-30秒 | 取决于深度 |

---

## 🔧 配置选项

### 队列优先级

```typescript
// 高优先级：用户主动触发的分析
triggerDeepAnalysis({ entryId, priority: 1 });

// 低优先级：后台自动分析
triggerDeepAnalysis({ entryId, priority: 10 });
```

### 反思轮数

```typescript
// 快速模式（1轮反思）
const reflection = new ReflectionEngine(llm);
await reflection.refine(content, analysis, 1);

// 高质量模式（3轮反思）
await reflection.refine(content, analysis, 3);
```

### 分段大小

```typescript
const analyzer = new SegmentedAnalyzer(llm, {
  maxSegmentTokens: 2000,  // 每段最大 tokens
  overlapTokens: 200,      // 段落重叠 tokens
  maxConcurrency: 3        // 并发分析数
});
```

---

## 📊 数据流转图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据流转可视化                                    │
└─────────────────────────────────────────────────────────────────────────────┘

外部 RSS 源
     │
     │ HTTP GET (with ETag/Last-Modified)
     ▼
┌─────────────┐
│ FeedManager │ ◄─── Redis Cache (24h)
└─────────────┘
     │
     │ RSS XML/JSON
     ▼
┌─────────────┐
│ RSS Parser  │ ◄─── Cheerio (content extraction)
└─────────────┘
     │
     │ Entry[]
     ▼
┌─────────────┐
│ Prisma ORM  │ ──▶ PostgreSQL
└─────────────┘
     │
     │ entryId[]
     ▼
┌─────────────┐
│ AI Queue    │ ◄─── BullMQ + Redis
└─────────────┘
     │
     │ Job Data
     ▼
┌─────────────┐
│ Worker      │
│ Process     │
└─────────────┘
     │
     │ AnalysisResult
     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ Entry Table │       │Vector Store │       │Relation     │
│             │       │(pgvector)   │       │Table        │
└─────────────┘       └─────────────┘       └─────────────┘
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                              ▼
                    ┌─────────────┐
                    │ tRPC API    │
                    └─────────────┘
                              │
                              ▼
                    ┌─────────────┐
                    │ Frontend    │
                    │ Components  │
                    └─────────────┘
```

---

## 🎯 总结

完整的 AI-Native 流程从 RSS 抓取开始，经过：

1. **数据获取** - FeedManager 抓取和解析 RSS
2. **基础处理** - 存储、基础 AI 分析
3. **深度分析** - 队列化异步处理
4. **智能增强** - 分段分析、反思优化、个性化评分
5. **知识组织** - 向量存储、关系抽取、图谱构建
6. **用户学习** - 行为追踪、偏好更新
7. **智能推荐** - 个性化推荐流、可视化展示

每个阶段都经过精心设计，确保：
- **性能**: 并行处理、队列化、缓存优化
- **质量**: 反思机制、多轮优化
- **个性化**: 用户偏好学习、行为追踪
- **可扩展**: 模块化架构、提供商抽象
