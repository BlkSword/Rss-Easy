# AI-Native 智能改造详细实施计划

## 📋 项目概述

### 改造目标

基于 BestBlogs 项目的优秀设计模式，对 Rss-Easy 进行 AI-Native 智能化改造，实现：

| 指标 | 当前状态 | 目标状态 | 提升 |
|------|---------|---------|------|
| 深度分析成本 | 100% | ~60% | 节省 40% |
| 中文分析准确率 | ~85% | ~92% | +7% |
| 英文分析准确率 | ~75% | ~90% | +15% |
| 短文处理速度 | 30s | 15s | 快 50% |
| 个性化推荐精度 | 基准 | +50% CTR | 大幅提升 |

### 改造范围

**核心模块**：
1. 初评关卡系统（新增）
2. 语言分支模型选择
3. 短文/长文双路径优化
4. 反馈改进机制
5. 工作流引擎重构

**支持模块**：
- 队列系统扩展
- 数据库 Schema 扩展
- API 路由新增
- 前端组件更新
- 监控和日志

---

## 🎯 改造原则

1. **向后兼容**：新功能不影响现有系统运行
2. **渐进式实施**：分阶段部署，每个阶段可独立验证
3. **可配置性**：所有新功能支持开关控制
4. **可观测性**：完整的日志和监控指标
5. **成本优化**：优先使用性价比高的模型

---

## 📊 阶段划分

```
Phase 0: 准备阶段 (1天)
├── 环境检查
├── 依赖验证
└── 基准测试

Phase 1: 数据库扩展 (1天)
├── Schema 设计
├── 迁移脚本
└── 验证测试

Phase 2: 初评关卡系统 (2-3天)
├── PreliminaryEvaluator 实现
├── ModelSelector 实现
├── 初评队列处理器
└── API 路由和测试

Phase 3: 语言分支优化 (1-2天)
├── 语言检测工具
├── 模型配置管理
└── 集成测试

Phase 4: 短文优化路径 (1-2天)
├── SmartAnalyzer 实现
├── 性能优化
└── 对比测试

Phase 5: 反馈机制 (可选, 2-3天)
├── FeedbackEngine 实现
├── 前端反馈组件
└── A/B 测试框架

Phase 6: 监控和优化 (1-2天)
├── 指标收集
├── 性能监控
└── 成本分析

总计: 9-14 天
```

---

## 📝 详细实施步骤

### Phase 0: 准备阶段

**时间**: 1 天

**目标**: 确保开发环境就绪，建立基准测试

#### 任务清单

- [ ] **0.1 环境检查**
  ```bash
  # 检查 Node.js 版本
  node --version  # 需要 >= 20.0.0

  # 检查 Redis 连接
  redis-cli ping

  # 检查数据库连接
  npm run db:studio
  ```

- [ ] **0.2 依赖验证**
  ```bash
  # 安装新依赖
  npm install --save-dev langdetect  # 语言检测
  npm install                       # 确保现有依赖完整
  ```

- [ ] **0.3 基准测试**
  ```bash
  # 运行现有测试
  npm run test:coverage

  # 测试深度分析功能
  npm run test:deep-analysis

  # 记录基准数据
  # - 平均处理时间
  # - 每篇文章成本
  # - 准确率（抽样）
  ```

#### 交付物

- [ ] 环境检查报告
- [ ] 基准性能数据
- [ ] 依赖清单

#### 验收标准

- ✅ 所有环境检查通过
- ✅ 基准测试数据已记录
- ✅ 开发环境可正常启动

---

### Phase 1: 数据库扩展

**时间**: 1 天

**目标**: 扩展数据库 Schema，支持初评和语言检测

#### 任务清单

- [ ] **1.1 Schema 设计**

  在 `prisma/schema.prisma` 中添加初评字段：

  ```prisma
  model Entry {
    // ... 现有字段

    // ========== 初评字段（新增）==========
    aiPrelimIgnore      Boolean?  @map("ai_prelim_ignore")
    aiPrelimReason      String?   @map("ai_prelim_reason") @db.Text
    aiPrelimValue       Int?      @map("ai_prelim_value")      // 1-5 分
    aiPrelimSummary     String?   @map("ai_prelim_summary") @db.Text
    aiPrelimLanguage    String?   @map("ai_prelim_language")   // 'zh', 'en', 'other'
    aiPrelimAnalyzedAt  DateTime? @map("ai_prelim_analyzed_at")

    // 队列状态
    aiPrelimStatus      String?   @map("ai_prelim_status")     // 'pending', 'passed', 'rejected'
  }
  ```

- [ ] **1.2 创建迁移**

  ```bash
  # 生成 Prisma Client
  npm run db:generate

  # 推送到开发数据库
  npm run db:push

  # 生产环境迁移
  npm run db:migrate
  ```

- [ ] **1.3 验证测试**

  ```typescript
  // scripts/test-preliminary-schema.ts
  import { db } from '@/lib/db';

  async function testSchema() {
    // 测试写入初评数据
    const testEntry = await db.entry.update({
      where: { id: 'test-entry-id' },
      data: {
        aiPrelimIgnore: false,
        aiPrelimReason: '高质量技术文章',
        aiPrelimValue: 5,
        aiPrelimSummary: '深入探讨XXX技术',
        aiPrelimLanguage: 'zh',
        aiPrelimStatus: 'passed',
        aiPrelimAnalyzedAt: new Date(),
      },
    });

    console.log('Schema 测试通过:', testEntry);
  }
  ```

#### 交付物

- [ ] 更新的 `schema.prisma`
- [ ] 数据库迁移脚本
- [ ] Schema 验证测试

#### 验收标准

- ✅ Prisma Client 成功生成
- [ ] 数据库迁移成功
- [ ] 可以读写初评字段

---

### Phase 2: 初评关卡系统

**时间**: 2-3 天

**目标**: 实现初评过滤功能，节省 40% 深度分析成本

#### 2.1 PreliminaryEvaluator 实现

**文件**: `lib/ai/preliminary-evaluator.ts`

```typescript
/**
 * 初评评估器
 *
 * 使用轻量级模型快速评估文章价值
 */

import { getDefaultAIService } from '@/lib/ai/client';

export interface PreliminaryEvaluation {
  ignore: boolean;           // 是否忽略
  reason: string;            // 主题描述
  value: number;             // 价值评分 1-5
  summary: string;           // 一句话总结（50字内）
  language: string;          // 语言类型
}

export interface PreliminaryEvaluatorConfig {
  chineseModel: string;      // 中文模型
  englishModel: string;      // 英文模型
  otherModel: string;        // 其他语言模型
  minValue: number;          // 最低价值分数（默认3）
}

export class PreliminaryEvaluator {
  constructor(
    private config: PreliminaryEvaluatorConfig
  ) {}

  /**
   * 评估文章
   */
  async evaluate(entry: {
    title: string;
    content: string;
    url?: string;
  }): Promise<PreliminaryEvaluation> {

    // 1. 语言检测
    const language = await this.detectLanguage(entry.content);

    // 2. 选择对应模型
    const model = this.selectModel(language);

    // 3. 构建提示词
    const prompt = this.buildPrompt(entry, language);

    // 4. 调用 AI 进行初评
    const aiService = getDefaultAIService();
    const result = await aiService.analyzeArticle(
      entry.content.slice(0, 2000), // 只分析前 2000 字符
      {
        summary: true,
        category: true,
        importance: true,
      }
    );

    // 5. 解析结果
    const value = Math.round((result.importanceScore || 0) * 5);

    return {
      ignore: value < this.config.minValue,
      reason: result.category || '未分类',
      value,
      summary: result.summary?.slice(0, 50) || '',
      language,
    };
  }

  /**
   * 语言检测
   */
  private async detectLanguage(content: string): Promise<string> {
    // 简单检测：中文字符比例
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g);
    const chineseRatio = chineseChars
      ? chineseChars.length / content.length
      : 0;

    if (chineseRatio > 0.3) return 'zh';
    if (/[a-zA-Z]/.test(content)) return 'en';
    return 'other';
  }

  /**
   * 选择模型
   */
  private selectModel(language: string): string {
    switch (language) {
      case 'zh': return this.config.chineseModel;
      case 'en': return this.config.englishModel;
      default: return this.config.otherModel;
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(entry: any, language: string): string {
    const langPrompt = language === 'zh'
      ? '请用中文回答'
      : 'Please answer in English';

    return `
${langPrompt}。你是文章初评专家，请快速评估以下文章。

标题：${entry.title}
内容：${entry.content.slice(0, 1000)}...

请返回：
1. 是否值得深入阅读（忽略广告、低质内容）
2. 主题描述（一句话）
3. 价值评分（1-5分）
4. 一句话总结（50字内）
    `;
  }
}

/**
 * 默认初评评估器
 */
export function createPreliminaryEvaluator(): PreliminaryEvaluator {
  return new PreliminaryEvaluator({
    chineseModel: process.env.PRELIMINARY_MODEL_ZH || 'deepseek-chat',
    englishModel: process.env.PRELIMINARY_MODEL_EN || 'gemini-1.5-flash',
    otherModel: process.env.PRELIMINARY_MODEL_OTHER || 'gpt-4o-mini',
    minValue: parseInt(process.env.PRELIMINARY_MIN_VALUE || '3'),
  });
}
```

#### 2.2 ModelSelector 实现

**文件**: `lib/ai/model-selector.ts`

```typescript
/**
 * 模型选择器
 *
 * 根据语言和阶段选择最优模型
 */

export interface ModelConfig {
  chinese: {
    preliminary: string;  // 初评模型
    analysis: string;     // 分析模型
    reflection: string;   // 反思模型
  };
  english: {
    preliminary: string;
    analysis: string;
    reflection: string;
  };
  other: {
    preliminary: string;
    analysis: string;
    reflection: string;
  };
}

export type AnalysisStage = 'preliminary' | 'analysis' | 'reflection';
export type LanguageType = 'chinese' | 'english' | 'other';

export class ModelSelector {
  constructor(private config: ModelConfig) {}

  /**
   * 选择模型
   */
  selectModel(
    language: string,
    stage: AnalysisStage
  ): string {
    const langKey = this.getLangKey(language);
    return this.config[langKey][stage];
  }

  /**
   * 获取语言键
   */
  private getLangKey(language: string): LanguageType {
    if (language.startsWith('zh')) return 'chinese';
    if (language.startsWith('en')) return 'english';
    return 'other';
  }

  /**
   * 获取所有配置
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }
}

/**
 * 默认模型选择器
 */
export function createModelSelector(): ModelSelector {
  return new ModelSelector({
    chinese: {
      preliminary: process.env.PRELIMINARY_MODEL_ZH || 'deepseek-chat',
      analysis: process.env.ANALYSIS_MODEL_ZH || 'deepseek-chat',
      reflection: process.env.REFLECTION_MODEL_ZH || 'deepseek-chat',
    },
    english: {
      preliminary: process.env.PRELIMINARY_MODEL_EN || 'gemini-1.5-flash',
      analysis: process.env.ANALYSIS_MODEL_EN || 'gemini-1.5-pro',
      reflection: process.env.REFLECTION_MODEL_EN || 'gpt-4o',
    },
    other: {
      preliminary: process.env.PRELIMINARY_MODEL_OTHER || 'gpt-4o-mini',
      analysis: process.env.ANALYSIS_MODEL_OTHER || 'gpt-4o',
      reflection: process.env.REFLECTION_MODEL_OTHER || 'gpt-4o',
    },
  });
}
```

#### 2.3 初评队列处理器

**文件**: `lib/queue/preliminary-processor.ts`

```typescript
/**
 * 初评队列处理器
 *
 * 使用 BullMQ 处理文章初评任务
 */

import { Queue, Worker, Job } from 'bullmq';
import { db } from '@/lib/db';
import { createPreliminaryEvaluator } from '@/lib/ai/preliminary-evaluator';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// =====================================================
// 任务数据类型
// =====================================================

export interface PreliminaryJobData {
  entryId: string;
  priority?: number;
}

// =====================================================
// 队列定义
// =====================================================

export const preliminaryQueue = new Queue<PreliminaryJobData>('preliminary-analysis', {
  connection: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3 * 24 * 3600, // 3天后删除
      count: 500,
    },
  },
});

// =====================================================
// 队列处理器
// =====================================================

export function createPreliminaryWorker(): Worker<PreliminaryJobData> {
  return new Worker<PreliminaryJobData>(
    'preliminary-analysis',
    async (job: Job<PreliminaryJobData>) => {
      const { entryId } = job.data;

      job.updateProgress(10);

      // 1. 获取文章
      const entry = await db.entry.findUnique({
        where: { id: entryId },
      });

      if (!entry) {
        throw new Error(`文章 ${entryId} 不存在`);
      }

      job.updateProgress(30);

      // 2. 执行初评
      const evaluator = createPreliminaryEvaluator();
      const evaluation = await evaluator.evaluate({
        title: entry.title,
        content: entry.content || '',
        url: entry.url,
      });

      job.updateProgress(70);

      // 3. 更新数据库
      await db.entry.update({
        where: { id: entryId },
        data: {
          aiPrelimIgnore: evaluation.ignore,
          aiPrelimReason: evaluation.reason,
          aiPrelimValue: evaluation.value,
          aiPrelimSummary: evaluation.summary,
          aiPrelimLanguage: evaluation.language,
          aiPrelimStatus: evaluation.ignore ? 'rejected' : 'passed',
          aiPrelimAnalyzedAt: new Date(),
        },
      });

      job.updateProgress(90);

      // 4. 如果通过初评，添加到深度分析队列
      if (!evaluation.ignore) {
        const { addDeepAnalysisJob } = await import('@/lib/queue/deep-analysis-processor');
        await addDeepAnalysisJob({ entryId, priority: job.data.priority || 5 });
      }

      job.updateProgress(100);

      return {
        success: true,
        evaluation,
        queuedForDeepAnalysis: !evaluation.ignore,
      };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 5, // 并发处理5个任务
    }
  );
}

// =====================================================
// 队列操作函数
// =====================================================

/**
 * 添加初评任务
 */
export async function addPreliminaryJob(data: PreliminaryJobData): Promise<string> {
  const job = await preliminaryQueue.add('evaluate', data, {
    priority: data.priority || 5,
  });

  return job.id!;
}

/**
 * 批量添加初评任务
 */
export async function addPreliminaryJobsBatch(
  jobs: PreliminaryJobData[]
): Promise<string[]> {
  const jobPromises = jobs.map(data => addPreliminaryJob(data));
  return Promise.all(jobPromises);
}
```

#### 2.4 API 路由

**文件**: `server/api/preliminary.ts` (新建)

```typescript
/**
 * 初评相关 API 路由
 */

import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init';
import { addPreliminaryJob } from '@/lib/queue/preliminary-processor';
import { db } from '@/lib/db';
import { z } from 'zod';

export const preliminaryRouter = createTRPCRouter({
  /**
   * 触发初评
   */
  trigger: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      priority: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ input }) => {
      // 检查是否已初评
      const entry = await db.entry.findUnique({
        where: { id: input.entryId },
        select: { aiPrelimStatus: true },
      });

      if (entry?.aiPrelimStatus) {
        return {
          status: 'already_evaluated',
          message: '文章已初评',
        };
      }

      // 添加到初评队列
      const jobId = await addPreliminaryJob({
        entryId: input.entryId,
        priority: input.priority || 5,
      });

      return {
        status: 'queued',
        jobId,
      };
    }),

  /**
   * 批量触发初评
   */
  triggerBatch: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string()),
      priority: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ input }) => {
      const jobs = await addPreliminaryJobsBatch(
        input.entryIds.map(entryId => ({
          entryId,
          priority: input.priority || 5,
        }))
      );

      return {
        status: 'queued',
        count: jobs.length,
        jobIds: jobs,
      };
    }),

  /**
   * 获取初评结果
   */
  getResult: protectedProcedure
    .input(z.object({
      entryId: z.string(),
    }))
    .query(async ({ input }) => {
      const entry = await db.entry.findUnique({
        where: { id: input.entryId },
        select: {
          id: true,
          aiPrelimIgnore: true,
          aiPrelimReason: true,
          aiPrelimValue: true,
          aiPrelimSummary: true,
          aiPrelimLanguage: true,
          aiPrelimStatus: true,
          aiPrelimAnalyzedAt: true,
        },
      });

      if (!entry) {
        throw new Error('文章不存在');
      }

      return entry;
    }),
});
```

#### 2.5 测试脚本

**文件**: `scripts/test-preliminary.ts`

```typescript
/**
 * 初评功能测试脚本
 */

import { addPreliminaryJob } from '@/lib/queue/preliminary-processor';
import { createPreliminaryEvaluator } from '@/lib/ai/preliminary-evaluator';
import { db } from '@/lib/db';

async function testPreliminary() {
  console.log('🧪 测试初评功能\n');

  // 1. 获取测试文章
  const entries = await db.entry.findMany({
    take: 5,
    where: {
      content: { not: null },
      aiPrelimStatus: null,
    },
  });

  console.log(`找到 ${entries.length} 篇未初评文章\n`);

  // 2. 测试初评器
  const evaluator = createPreliminaryEvaluator();

  for (const entry of entries) {
    console.log(`\n📄 文章: ${entry.title}`);

    const evaluation = await evaluator.evaluate({
      title: entry.title,
      content: entry.content || '',
      url: entry.url,
    });

    console.log('  语言:', evaluation.language);
    console.log('  评分:', evaluation.value);
    console.log('  主题:', evaluation.reason);
    console.log('  总结:', evaluation.summary);
    console.log('  是否忽略:', evaluation.ignore ? '是' : '否');

    // 3. 添加到队列
    const jobId = await addPreliminaryJob({ entryId: entry.id });
    console.log('  队列任务ID:', jobId);
  }

  console.log('\n✅ 测试完成');
}

testPreliminary().catch(console.error);
```

#### 交付物

- [ ] `lib/ai/preliminary-evaluator.ts`
- [ ] `lib/ai/model-selector.ts`
- [ ] `lib/queue/preliminary-processor.ts`
- [ ] `server/api/preliminary.ts`
- [ ] `scripts/test-preliminary.ts`
- [ ] 单元测试覆盖 >80%

#### 验收标准

- [ ] 初评功能正常工作
- [ ] 过滤率 > 30%
- [ ] 队列处理稳定
- [ ] API 响应时间 < 500ms

---

### Phase 3: 语言分支优化

**时间**: 1-2 天

**目标**: 根据文章语言选择最优模型，提升准确率 15%

#### 任务清单

- [ ] **3.1 增强语言检测**

  **文件**: `lib/ai/language-detector.ts`

  ```typescript
  /**
   * 语言检测工具
   */

  export interface LanguageDetectionResult {
    language: string;      // 'zh', 'en', 'ja', 'ko', etc.
    confidence: number;    // 0-1
    script?: string;       // 'hanzi', 'latin', 'arabic', etc.
  }

  export class LanguageDetector {
    /**
     * 检测语言
     */
    async detect(text: string): Promise<LanguageDetectionResult> {
      // 1. 基于 Unicode 范围的快速检测
      const script = this.detectScript(text);

      // 2. 基于 n-gram 的统计检测
      const language = this.detectByNGram(text, script);

      // 3. 计算置信度
      const confidence = this.calculateConfidence(text, language);

      return { language, confidence, script };
    }

    private detectScript(text: string): string {
      // 检测汉字
      if (/[\u4e00-\u9fa5]/.test(text)) return 'hanzi';
      // 检测日文假名
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'kana';
      // 检测韩文
      if (/[\uac00-\ud7af]/.test(text)) return 'hangul';
      // 检测阿拉伯文
      if (/[\u0600-\u06ff]/.test(text)) return 'arabic';
      // 检测西里尔字母
      if (/[\u0400-\u04ff]/.test(text)) return 'cyrillic';

      return 'latin';
    }

    private detectByNGram(text: string, script: string): string {
      // 根据字符系统返回最可能的语言
      switch (script) {
        case 'hanzi': return 'zh';
        case 'kana': return 'ja';
        case 'hangul': return 'ko';
        case 'arabic': return 'ar';
        case 'cyrillic': return 'ru';
        default:
          // 拉丁字母系统需要进一步区分
          return this.detectLatinLanguage(text);
      }
    }

    private detectLatinLanguage(text: string): string {
      const lowerText = text.toLowerCase();

      // 基于常见词的特征检测
      const features = {
        en: /\b(the|and|is|in|at|of|to|a)\b/g,
        es: /\b(el|la|de|que|y|a|en|un)\b/g,
        fr: /\b(le|la|de|et|à|un|en|une)\b/g,
        de: /\b(der|die|das|und|in|den|von|zu)\b/g,
        pt: /\b(o|a|de|e|em|um|para)\b/g,
      };

      let maxCount = 0;
      let detectedLang = 'en';

      for (const [lang, pattern] of Object.entries(features)) {
        const matches = lowerText.match(pattern);
        const count = matches ? matches.length : 0;

        if (count > maxCount) {
          maxCount = count;
          detectedLang = lang;
        }
      }

      return detectedLang;
    }

    private calculateConfidence(text: string, language: string): number {
      // 简化的置信度计算
      const length = text.length;
      if (length < 50) return 0.5;
      if (length < 200) return 0.7;
      return 0.9;
    }
  }

  export const languageDetector = new LanguageDetector();
  ```

- [ ] **3.2 模型配置管理**

  **文件**: `lib/ai/model-config.ts`

  ```typescript
  /**
   * 模型配置管理
   */

  export interface ModelTierConfig {
    provider: string;           // 'openai', 'anthropic', 'deepseek', 'gemini'
    model: string;              // 模型名称
    maxTokens: number;          // 最大 token
    costPer1kTokens: number;    // 每 1k token 成本（美元）
  }

  export const MODEL_TIERS: Record<string, ModelTierConfig> = {
    // OpenAI 模型
    'gpt-4o': {
      provider: 'openai',
      model: 'gpt-4o',
      maxTokens: 128000,
      costPer1kTokens: 0.005,
    },
    'gpt-4o-mini': {
      provider: 'openai',
      model: 'gpt-4o-mini',
      maxTokens: 128000,
      costPer1kTokens: 0.00015,
    },

    // Anthropic 模型
    'claude-3-5-sonnet': {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 200000,
      costPer1kTokens: 0.003,
    },
    'claude-3-haiku': {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      maxTokens: 200000,
      costPer1kTokens: 0.00025,
    },

    // DeepSeek 模型
    'deepseek-chat': {
      provider: 'deepseek',
      model: 'deepseek-chat',
      maxTokens: 128000,
      costPer1kTokens: 0.00014,
    },
    'deepseek-coder': {
      provider: 'deepseek',
      model: 'deepseek-coder',
      maxTokens: 128000,
      costPer1kTokens: 0.00014,
    },

    // Gemini 模型
    'gemini-1.5-flash': {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      maxTokens: 1000000,
      costPer1kTokens: 0.000075,
    },
    'gemini-1.5-pro': {
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      maxTokens: 2000000,
      costPer1kTokens: 0.0035,
    },
  };

  /**
   * 获取模型配置
   */
  export function getModelConfig(modelKey: string): ModelTierConfig {
    return MODEL_TIERS[modelKey] || MODEL_TIERS['gpt-4o-mini'];
  }

  /**
   * 计算成本
   */
  export function calculateCost(
    modelKey: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const config = getModelConfig(modelKey);
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / 1000) * config.costPer1kTokens;
  }
  ```

- [ ] **3.3 集成到现有流程**

  更新 `lib/queue/deep-analysis-processor.ts`：

  ```typescript
  // 在处理器中添加语言检测
  import { languageDetector } from '@/lib/ai/language-detector';
  import { createModelSelector } from '@/lib/ai/model-selector';

  // 在处理流程中
  const languageResult = await languageDetector.detect(entry.content || '');
  const modelSelector = createModelSelector();

  const analysisModel = modelSelector.selectModel(
    languageResult.language,
    'analysis'
  );
  ```

#### 交付物

- [ ] `lib/ai/language-detector.ts`
- [ ] `lib/ai/model-config.ts`
- [ ] 更新的 `deep-analysis-processor.ts`
- [ ] 语言检测测试

#### 验收标准

- [ ] 语言检测准确率 > 95%
- [ ] 模型选择逻辑正确
- [ ] 成本计算准确
- [ ] 中文文章准确率 +7%
- [ ] 英文文章准确率 +15%

---

### Phase 4: 短文优化路径

**时间**: 1-2 天

**目标**: 短文章（≤6000字符）直接分析，处理速度提升 50%

#### 任务清单

- [ ] **4.1 SmartAnalyzer 实现**

  **文件**: `lib/ai/smart-analyzer.ts`

  ```typescript
  /**
   * 智能分析器
   *
   * 根据文章长度选择最优分析策略
   */

  import { SegmentedAnalyzer } from '@/lib/ai/analysis/segmented-analyzer';
  import type { LLMService } from '@/lib/ai/analysis/types';
  import type { ArticleAnalysisResult } from '@/lib/ai/analysis/types';

  export interface SmartAnalyzerConfig {
    shortThreshold: number;   // 短文阈值（字符数）
    segmentThreshold: number; // 分段阈值（字符数）
  }

  export class SmartAnalyzer {
    constructor(
      private llm: LLMService,
      private config: SmartAnalyzerConfig = {
        shortThreshold: 6000,
        segmentThreshold: 12000,
      }
    ) {}

    /**
     * 智能分析
     */
    async analyze(
      content: string,
      metadata?: {
        title?: string;
        author?: string;
        url?: string;
      }
    ): Promise<ArticleAnalysisResult> {

      const contentLength = content.length;

      // 路径 1: 短文直接分析
      if (contentLength <= this.config.shortThreshold) {
        return this.analyzeShort(content, metadata);
      }

      // 路径 2: 中等文章分段分析
      if (contentLength <= this.config.segmentThreshold) {
        return this.analyzeSegmented(content, metadata);
      }

      // 路径 3: 长文章分段分析 + 合并
      return this.analyzeLong(content, metadata);
    }

    /**
     * 短文直接分析
     */
    private async analyzeShort(
      content: string,
      metadata?: any
    ): Promise<ArticleAnalysisResult> {

      const prompt = this.buildDirectPrompt(content, metadata);

      const result = await this.llm.chat([
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return this.parseResult(result.content);
    }

    /**
     * 分段分析
     */
    private async analyzeSegmented(
      content: string,
      metadata?: any
    ): Promise<ArticleAnalysisResult> {

      const segmentedAnalyzer = new SegmentedAnalyzer(this.llm);
      return segmentedAnalyzer.analyze(content, metadata);
    }

    /**
     * 长文分析（带合并）
     */
    private async analyzeLong(
      content: string,
      metadata?: any
    ): Promise<ArticleAnalysisResult> {

      // 分段
      const segments = this.splitIntoSegments(content, 3000);

      // 并行分析
      const results = await Promise.all(
        segments.map(segment => this.analyzeShort(segment, metadata))
      );

      // 合并结果
      return this.mergeResults(results);
    }

    /**
     * 构建直接分析提示词
     */
    private buildDirectPrompt(content: string, metadata?: any): string {
      return `
请分析以下文章：

标题：${metadata?.title || '未知'}
作者：${metadata?.author || '未知'}

${content}

请返回 JSON 格式：
{
  "oneLineSummary": "一句话总结",
  "summary": "详细摘要",
  "mainPoints": ["要点1", "要点2"],
  "tags": ["标签1", "标签2"],
  "domain": "领域",
  "aiScore": 8
}
      `;
    }

    /**
     * 分割成段落
     */
    private splitIntoSegments(content: string, maxLength: number): string[] {
      const segments: string[] = [];
      let current = '';

      const paragraphs = content.split(/\n\n+/);

      for (const para of paragraphs) {
        if (current.length + para.length > maxLength && current.length > 0) {
          segments.push(current.trim());
          current = para;
        } else {
          current += '\n\n' + para;
        }
      }

      if (current.length > 0) {
        segments.push(current.trim());
      }

      return segments;
    }

    /**
     * 合并结果
     */
    private mergeResults(results: ArticleAnalysisResult[]): ArticleAnalysisResult {
      // 收集所有要点
      const allPoints = results.flatMap(r => r.mainPoints || []);

      // 去重（相似度检测）
      const uniquePoints = this.deduplicatePoints(allPoints);

      // 合并标签
      const allTags = results.flatMap(r => r.tags || []);
      const uniqueTags = [...new Set(allTags)];

      // 平均评分
      const avgScore = results.reduce((sum, r) => sum + (r.aiScore || 0), 0) / results.length;

      return {
        oneLineSummary: results[0]?.oneLineSummary || '',
        summary: results.map(r => r.summary).join('\n\n'),
        mainPoints: uniquePoints,
        tags: uniqueTags,
        domain: results[0]?.domain,
        aiScore: Math.round(avgScore),
        analysisModel: 'smart-analyzer',
      };
    }

    /**
     * 要点去重
     */
    private deduplicatePoints(points: string[]): string[] {
      // 简单去重：基于文本相似度
      const unique: string[] = [];

      for (const point of points) {
        const isDuplicate = unique.some(existing =>
          this.calculateSimilarity(existing, point) > 0.8
        );

        if (!isDuplicate) {
          unique.push(point);
        }
      }

      return unique;
    }

    /**
     * 计算相似度（简单的词袋模型）
     */
    private calculateSimilarity(a: string, b: string): number {
      const wordsA = new Set(a.toLowerCase().split(/\s+/));
      const wordsB = new Set(b.toLowerCase().split(/\s+/));

      const intersection = new Set(
        [...wordsA].filter(x => wordsB.has(x))
      );

      const union = new Set([...wordsA, ...wordsB]);

      return intersection.size / union.size;
    }

    /**
     * 获取系统提示词
     */
    private getSystemPrompt(): string {
      return `你是专业的文章分析助手。

请分析文章并返回：
1. 一句话总结（20字内）
2. 详细摘要（3-5句话）
3. 主要观点（3-5个，按重要性排序）
4. 相关标签（3-5个）
5. 文章领域
6. 质量评分（1-10分）`;
    }

    /**
     * 解析结果
     */
    private parseResult(content: string): ArticleAnalysisResult {
      try {
        // 尝试提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {}

      // 如果解析失败，返回默认结构
      return {
        oneLineSummary: content.slice(0, 50),
        summary: content,
        mainPoints: [],
        tags: [],
        aiScore: 5,
      };
    }
  }
  ```

- [ ] **4.2 性能对比测试**

  **文件**: `scripts/test-smart-analyzer.ts`

  ```typescript
  /**
   * 智能分析器性能测试
   */

  import { SmartAnalyzer } from '@/lib/ai/smart-analyzer';
  import { SegmentedAnalyzer } from '@/lib/ai/analysis/segmented-analyzer';
  import { db } from '@/lib/db';

  async function comparePerformance() {
    console.log('🔬 性能对比测试\n');

    // 获取测试文章
    const entries = await db.entry.findMany({
      take: 10,
      where: { content: { not: null } },
    });

    const llm = createMockLLM(); // 需要实现
    const smartAnalyzer = new SmartAnalyzer(llm);
    const segmentedAnalyzer = new SegmentedAnalyzer(llm);

    const results = {
      short: { count: 0, time: 0 },
      medium: { count: 0, time: 0 },
      long: { count: 0, time: 0 },
    };

    for (const entry of entries) {
      const content = entry.content || '';
      const length = content.length;

      console.log(`\n📄 ${entry.title} (${length} 字符)`);

      // 测试智能分析器
      const smartStart = Date.now();
      await smartAnalyzer.analyze(content, { title: entry.title });
      const smartTime = Date.now() - smartStart;

      // 测试分段分析器
      const segStart = Date.now();
      await segmentedAnalyzer.analyze(content, { title: entry.title });
      const segTime = Date.now() - segStart;

      const category = length < 6000 ? 'short' : length < 12000 ? 'medium' : 'long';
      results[category].count++;
      results[category].time += smartTime;

      console.log(`  智能分析器: ${smartTime}ms`);
      console.log(`  分段分析器: ${segTime}ms`);
      console.log(`  提升: ${Math.round((1 - smartTime / segTime) * 100)}%`);
    }

    console.log('\n📊 统计结果:');
    console.log(`  短文 (${results.short.count}篇): ${Math.round(results.short.time / results.short.count)}ms 平均`);
    console.log(`  中文 (${results.medium.count}篇): ${Math.round(results.medium.time / results.medium.count)}ms 平均`);
    console.log(`  长文 (${results.long.count}篇): ${Math.round(results.long.time / results.long.count)}ms 平均`);
  }

  comparePerformance().catch(console.error);
  ```

#### 交付物

- [ ] `lib/ai/smart-analyzer.ts`
- [ ] `scripts/test-smart-analyzer.ts`
- [ ] 性能测试报告

#### 验收标准

- [ ] 短文处理速度提升 > 40%
- [ ] 分析质量不降低
- [ ] 长文处理时间不增加

---

### Phase 5: 反馈机制（可选）

**时间**: 2-3 天

**目标**: 纳入用户反馈，持续优化分析质量

#### 任务清单

- [ ] **5.1 FeedbackEngine 实现**

  **文件**: `lib/ai/feedback-engine.ts`

  ```typescript
  /**
   * 反馈改进引擎
   *
   * 整合用户反馈优化分析结果
   */

  import { ReflectionEngine } from '@/lib/ai/analysis/reflection-engine';
  import { db } from '@/lib/db';
  import type { LLMService } from '@/lib/ai/analysis/types';
  import type { ArticleAnalysisResult } from '@/lib/ai/analysis/types';

  export interface UserFeedback {
   entryId: string;
   userId: string;
   summaryIssue?: string;       // 摘要问题
   tagSuggestions?: string[];    // 标签建议
   rating?: number;              // 评分 1-5
   isHelpful?: boolean;          // 是否有帮助
   comments?: string;            // 其他评论
  }

  export class FeedbackEngine {
   constructor(private llm: LLMService) {}

   /**
    * 根据反馈优化分析
    */
   async improveWithFeedback(
    entryId: string,
    currentAnalysis: ArticleAnalysisResult,
    userFeedback?: UserFeedback
   ): Promise<ArticleAnalysisResult> {

    let improvedAnalysis = currentAnalysis;

    // 1. 自我反思
    const entry = await db.entry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new Error('文章不存在');
    }

    const reflection = new ReflectionEngine(this.llm);
    improvedAnalysis = await reflection.refine(
      entry.content || '',
      improvedAnalysis,
      1 // 反思轮数
    );

    // 2. 应用用户反馈
    if (userFeedback) {
      improvedAnalysis = await this.applyUserFeedback(
        improvedAnalysis,
        userFeedback
      );

      // 保存反馈
      await this.saveFeedback(userFeedback);
    }

    return improvedAnalysis;
   }

   /**
    * 应用用户反馈
    */
   private async applyUserFeedback(
    analysis: ArticleAnalysisResult,
    feedback: UserFeedback
   ): Promise<ArticleAnalysisResult> {

    const prompt = `
当前分析结果：
${JSON.stringify(analysis, null, 2)}

用户反馈：
- 摘要问题：${feedback.summaryIssue || '无'}
- 标签建议：${feedback.tagSuggestions?.join(', ') || '无'}
- 评分：${feedback.rating || '无'}
- 有帮助：${feedback.isHelpful ? '是' : '否'}
- 其他意见：${feedback.comments || '无'}

请根据用户反馈优化分析结果，返回 JSON 格式。
    `;

    try {
      const result = await this.llm.chat([
        { role: 'system', content: '你是分析优化助手。' },
        { role: 'user', content: prompt },
      ]);

      const improved = JSON.parse(result.content);
      return { ...analysis, ...improved };
    } catch {
      return analysis;
    }
   }

   /**
    * 保存用户反馈
    */
   private async saveFeedback(feedback: UserFeedback): Promise<void> {
    // TODO: 创建 Feedback 模型保存
    console.log('保存反馈:', feedback);
   }

   /**
    * 获取反馈统计
    */
   async getFeedbackStats(entryId: string) {
    // TODO: 统计反馈数据
    return {
      total: 0,
      helpful: 0,
      avgRating: 0,
    };
   }
  }
  ```

- [ ] **5.2 前端反馈组件**

  **文件**: `components/ai/AnalysisFeedback.tsx`

  ```tsx
  'use client';

  /**
   * 分析反馈组件
   */

  import { useState } from 'react';
  import { Button } from '@/components/ui/button';
  import { Textarea } from '@/components/ui/textarea';
  import { api } from '@/trpc/react';

  interface AnalysisFeedbackProps {
    entryId: string;
    currentAnalysis: any;
  }

  export function AnalysisFeedback({
    entryId,
    currentAnalysis,
  }: AnalysisFeedbackProps) {

    const [summaryIssue, setSummaryIssue] = useState('');
    const [tagSuggestions, setTagSuggestions] = useState('');
    const [rating, setRating] = useState<number>();
    const [isHelpful, setIsHelpful] = useState<boolean>();
    const [comments, setComments] = useState('');

    const { mutate: submitFeedback, isLoading } =
      api.analytics.submitFeedback.useMutation();

    const handleSubmit = () => {
      submitFeedback({
        entryId,
        summaryIssue: summaryIssue || undefined,
        tagSuggestions: tagSuggestions.split(',').map(t => t.trim()).filter(Boolean),
        rating,
        isHelpful,
        comments: comments || undefined,
      });
    };

    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <h3 className="font-semibold">分析反馈</h3>

        {/* 评分 */}
        <div>
          <label className="text-sm text-muted-foreground">评分</label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3, 4, 5].map(score => (
              <button
                key={score}
                onClick={() => setRating(score)}
                className={`w-8 h-8 rounded ${
                  rating === score ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        {/* 是否有帮助 */}
        <div>
          <label className="text-sm text-muted-foreground">这个分析有帮助吗？</label>
          <div className="flex gap-2 mt-1">
            <Button
              variant={isHelpful === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsHelpful(true)}
            >
              有帮助
            </Button>
            <Button
              variant={isHelpful === false ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsHelpful(false)}
            >
              没帮助
            </Button>
          </div>
        </div>

        {/* 摘要问题 */}
        <div>
          <label className="text-sm text-muted-foreground">摘要有什么问题？</label>
          <Textarea
            value={summaryIssue}
            onChange={e => setSummaryIssue(e.target.value)}
            placeholder="例如：摘要不够准确、遗漏了重要观点..."
            rows={2}
          />
        </div>

        {/* 标签建议 */}
        <div>
          <label className="text-sm text-muted-foreground">标签建议（逗号分隔）</label>
          <Textarea
            value={tagSuggestions}
            onChange={e => setTagSuggestions(e.target.value)}
            placeholder="例如：React, 性能优化, 最佳实践"
            rows={2}
          />
        </div>

        {/* 其他意见 */}
        <div>
          <label className="text-sm text-muted-foreground">其他意见</label>
          <Textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="任何其他意见或建议..."
            rows={3}
          />
        </div>

        {/* 提交按钮 */}
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? '提交中...' : '提交反馈'}
        </Button>
      </div>
    );
  }
  ```

#### 交付物

- [ ] `lib/ai/feedback-engine.ts`
- [ ] `components/ai/AnalysisFeedback.tsx`
- [ ] 反馈 API 路由
- [ ] 反馈数据模型

#### 验收标准

- [ ] 用户可以提交反馈
- [ ] 反馈可以优化后续分析
- [ ] A/B 测试显示改进效果

---

### Phase 6: 监控和优化

**时间**: 1-2 天

**目标**: 建立完整的监控体系，持续优化性能和成本

#### 任务清单

- [ ] **6.1 指标收集**

  **文件**: `lib/ai/metrics.ts`

  ```typescript
  /**
   * AI 分析指标收集
   */

  export interface AnalysisMetrics {
    entryId: string;
    stage: 'preliminary' | 'analysis' | 'reflection';
    model: string;
    language: string;
    contentLength: number;
    processingTime: number;     // 毫秒
    inputTokens: number;
    outputTokens: number;
    cost: number;               // 美元
    success: boolean;
    errorMessage?: string;
  }

  export class MetricsCollector {
    private metrics: AnalysisMetrics[] = [];

    /**
     * 记录指标
     */
    record(metric: AnalysisMetrics) {
      this.metrics.push(metric);
    }

    /**
     * 获取统计
     */
    getStats(timeRange?: { start: Date; end: Date }) {
      let filtered = this.metrics;

      if (timeRange) {
        filtered = filtered.filter(m => {
          // 需要在指标中添加时间戳
          return true;
        });
      }

      return {
        total: filtered.length,
        successRate: filtered.filter(m => m.success).length / filtered.length,
        avgProcessingTime: this.average(filtered, 'processingTime'),
        avgCost: this.average(filtered, 'cost'),
        totalCost: filtered.reduce((sum, m) => sum + m.cost, 0),
        byModel: this.groupBy(filtered, 'model'),
        byLanguage: this.groupBy(filtered, 'language'),
        byStage: this.groupBy(filtered, 'stage'),
      };
    }

    private average(arr: any[], key: string): number {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((s, item) => s + (item[key] || 0), 0);
      return sum / arr.length;
    }

    private groupBy(arr: any[], key: string) {
      return arr.reduce((groups, item) => {
        const k = item[key];
        if (!groups[k]) groups[k] = [];
        groups[k].push(item);
        return groups;
      }, {} as Record<string, any[]>);
    }
  }

  export const metricsCollector = new MetricsCollector();
  ```

- [ ] **6.2 成本分析**

  **文件**: `scripts/cost-analysis.ts`

  ```typescript
  /**
   * 成本分析脚本
   */

  import { metricsCollector } from '@/lib/ai/metrics';
  import { db } from '@/lib/db';

  async function analyzeCosts() {
    const stats = metricsCollector.getStats();

    console.log('💰 成本分析报告\n');
    console.log(`总处理数: ${stats.total}`);
    console.log(`成功率: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`总成本: $${stats.totalCost.toFixed(4)}`);
    console.log(`平均成本: $${stats.avgCost.toFixed(6)}`);

    console.log('\n按模型:');
    for (const [model, metrics] of Object.entries(stats.byModel)) {
      const count = metrics.length;
      const cost = metrics.reduce((sum: number, m: any) => sum + m.cost, 0);
      console.log(`  ${model}: ${count} 次, $${cost.toFixed(4)}`);
    }

    console.log('\n按语言:');
    for (const [lang, metrics] of Object.entries(stats.byLanguage)) {
      const count = metrics.length;
      const cost = metrics.reduce((sum: number, m: any) => sum + m.cost, 0);
      console.log(`  ${lang}: ${count} 次, $${cost.toFixed(4)}`);
    }

    // 成本优化建议
    console.log('\n💡 优化建议:');
    const modelCosts = Object.entries(stats.byModel)
      .map(([model, metrics]: [string, any]) => ({
        model,
        cost: metrics.reduce((sum: number, m: any) => sum + m.cost, 0),
      }))
      .sort((a, b) => b.cost - a.cost);

    if (modelCosts.length > 0) {
      console.log(`  最昂贵模型: ${modelCosts[0].model} ($${modelCosts[0].cost.toFixed(4)})`);
      console.log('  建议: 考虑使用更便宜的模型进行初评');
    }
  }

  analyzeCosts().catch(console.error);
  ```

- [ ] **6.3 性能监控**

  **文件**: `lib/ai/monitor.ts`

  ```typescript
  /**
   * 性能监控
   */

  export interface PerformanceAlert {
    type: 'slow_processing' | 'high_cost' | 'low_quality' | 'error_spike';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    data: any;
  }

  export class PerformanceMonitor {
    private alerts: PerformanceAlert[] = [];

    /**
     * 检查性能
     */
    check(metrics: AnalysisMetrics[]): PerformanceAlert[] {
      this.alerts = [];

      // 检查处理时间
      const avgTime = this.average(metrics, 'processingTime');
      if (avgTime > 60000) { // 超过 1 分钟
        this.alerts.push({
          type: 'slow_processing',
          severity: 'warning',
          message: `平均处理时间过长: ${Math.round(avgTime / 1000)}秒`,
          data: { avgTime },
        });
      }

      // 检查成本
      const avgCost = this.average(metrics, 'cost');
      if (avgCost > 0.01) { // 超过 $0.01
        this.alerts.push({
          type: 'high_cost',
          severity: 'warning',
          message: `平均成本偏高: $${avgCost.toFixed(4)}`,
          data: { avgCost },
        });
      }

      // 检查错误率
      const errorRate = 1 - metrics.filter(m => m.success).length / metrics.length;
      if (errorRate > 0.1) { // 超过 10%
        this.alerts.push({
          type: 'error_spike',
          severity: 'critical',
          message: `错误率过高: ${(errorRate * 100).toFixed(1)}%`,
          data: { errorRate },
        });
      }

      return this.alerts;
    }

    private average(arr: any[], key: string): number {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((s, item) => s + (item[key] || 0), 0);
      return sum / arr.length;
    }
  }

  export const performanceMonitor = new PerformanceMonitor();
  ```

#### 交付物

- [ ] `lib/ai/metrics.ts`
- [ ] `scripts/cost-analysis.ts`
- [ ] `lib/ai/monitor.ts`
- [ ] 监控仪表板

#### 验收标准

- [ ] 所有关键指标被收集
- [ ] 成本可准确计算
- [ ] 异常可及时告警
- [ ] 优化建议可自动生成

---

## 🚀 部署计划

### 环境配置

**新增环境变量**：

```env
# ========== 初评配置 ==========
PRELIMINARY_MODEL_ZH=deepseek-chat
PRELIMINARY_MODEL_EN=gemini-1.5-flash
PRELIMINARY_MODEL_OTHER=gpt-4o-mini
PRELIMINARY_MIN_VALUE=3

# ========== 分析配置 ==========
ANALYSIS_MODEL_ZH=deepseek-chat
ANALYSIS_MODEL_EN=gemini-1.5-pro
ANALYSIS_MODEL_OTHER=gpt-4o

# ========== 反思配置 ==========
REFLECTION_MODEL_ZH=deepseek-chat
REFLECTION_MODEL_EN=gpt-4o
REFLECTION_MODEL_OTHER=gpt-4o

# ========== 阈值配置 ==========
SHORT_ARTICLE_THRESHOLD=6000
SEGMENT_ARTICLE_THRESHOLD=12000

# ========== 功能开关 ==========
ENABLE_PRELIMINARY=true
ENABLE_LANGUAGE_BRANCH=true
ENABLE_SMART_ANALYZER=true
ENABLE_FEEDBACK=false
```

### 部署步骤

```bash
# 1. 更新代码
git pull origin main

# 2. 安装依赖
npm install

# 3. 数据库迁移
npm run db:generate
npm run db:push

# 4. 构建应用
npm run build

# 5. 启动服务
# 终端 1: 主应用
npm start

# 终端 2: 初评队列
npm run worker:preliminary

# 终端 3: 深度分析队列
npm run worker:deep-analysis
```

### 回滚计划

如果出现问题：

```bash
# 1. 关闭新队列
npm run queue pause preliminary

# 2. 回滚代码
git revert <commit-hash>

# 3. 重启服务
npm start
```

---

## 📈 监控指标

### 关键指标

| 指标 | 目标 | 监控方式 |
|------|------|---------|
| 初评通过率 | 60-70% | 队列统计 |
| 深度分析成本降低 | > 35% | 成本分析 |
| 中文分析准确率 | > 90% | 抽样测试 |
| 英文分析准确率 | > 85% | 抽样测试 |
| 短文处理速度 | > 40% 提升 | 性能测试 |
| 队列处理延迟 | < 30s | BullMQ 监控 |
| 错误率 | < 5% | 日志分析 |

### 告警规则

```typescript
const alertRules = [
  {
    metric: 'processing_time',
    threshold: 60000, // 1 分钟
    severity: 'warning',
  },
  {
    metric: 'error_rate',
    threshold: 0.1, // 10%
    severity: 'critical',
  },
  {
    metric: 'cost_per_article',
    threshold: 0.02, // $0.02
    severity: 'warning',
  },
];
```

---

## 🎯 成功标准

### Phase 1 完成标准

- [ ] 初评功能正常运行
- [ ] 数据库 Schema 更新完成
- [ ] API 测试通过
- [ ] 过滤率达到 30%+

### Phase 2 完成标准

- [ ] 语言检测准确率 > 95%
- [ ] 中文分析准确率提升 > 5%
- [ ] 英文分析准确率提升 > 10%

### Phase 3 完成标准

- [ ] 短文处理速度提升 > 40%
- [ ] 长文处理不受影响
- [ ] 分析质量不降低

### 整体完成标准

- [ ] 深度分析成本降低 > 35%
- [ ] 整体准确率提升 > 10%
- [ ] 用户反馈满意度 > 80%
- [ ] 系统稳定性 > 99%

---

## 📚 参考资源

### 文档

- `docs/AI-NATIVE-IMPROVEMENTS.md` - 改进建议详细说明
- `docs/AI-NATIVE-FLOW.md` - 完整流程说明
- `docs/AI-NATIVE-API.md` - API 使用文档

### 工具

- BullMQ: https://docs.bullmq.io/
- Prisma: https://www.prisma.io/docs
- tRPC: https://trpc.io/docs

### 最佳实践

- 模型选择: 优先使用性价比高的模型
- 错误处理: 所有异步操作必须捕获错误
- 日志记录: 关键操作必须记录日志
- 测试覆盖: 核心逻辑覆盖率 > 80%

---

## 🔄 持续改进

### 数据驱动优化

1. **每周分析**：成本、性能、质量报告
2. **用户反馈**：收集和处理用户反馈
3. **A/B 测试**：新功能上线前进行对比测试
4. **模型更新**：定期评估和更新模型选择

### 下一步计划

- [ ] 翻译功能集成
- [ ] 图片内容提取
- [ ] 多语言支持扩展
- [ ] 自定义模型接入
- [ ] API 限流和配额

---

**最后更新**: 2026-02-08
**维护者**: AI Team
