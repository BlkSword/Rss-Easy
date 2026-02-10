# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Rss-Easy 是一个智能 RSS 资讯聚合平台，使用 Next.js 16 + App Router 构建的全栈应用。核心特性包括 AI 智能增强（摘要、分类、情感分析）、全文/语义搜索、自动化订阅规则和报告生成系统。

## 开发命令

```bash
# 开发
npm run dev              # 启动开发服务器（使用 Turbopack）
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # ESLint 检查

# 测试
npm run test             # 运行测试
npm run test:watch       # 监听模式运行测试
npm run test:coverage    # 生成测试覆盖率报告

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 schema 变更到数据库（开发环境）
npm run db:migrate       # 运行数据库迁移（生产环境）
npm run db:studio        # 打开 Prisma Studio
npm run db:seed          # 填充初始数据

# AI-Native 智能分析脚本
npm run test:preliminary      # 测试初步评估
npm run test:deep-analysis    # 测试深度分析
npm run test:smart-analyzer   # 测试智能分析器
npm run cost-analysis         # 成本分析报告
npm run worker:preliminary    # 启动初步评估 Worker
npm run worker:deep-analysis  # 启动深度分析 Worker
npm run queue                 # 队列管理工具

# Docker 部署
docker-compose up -d     # 启动所有服务（数据库 + Redis + 应用）
docker-compose down      # 停止所有服务
docker-compose logs -f   # 查看日志

# 一键启动脚本（推荐用于本地开发）
start.bat                # Windows: 启动 Docker 服务、数据库迁移和应用
./start.sh              # Linux/macOS: 同上
```

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI**: Tailwind CSS 4 + Ant Design 6 + shadcn/ui + Lucide Icons
- **API**: tRPC (主要) + REST API (webhook/外部集成)
- **数据库**: PostgreSQL + Prisma ORM + pgvector (向量搜索)
- **认证**: JWT (jose) + HTTP-only Cookies
- **任务队列**: BullMQ + Redis
- **AI**: OpenAI / Anthropic / DeepSeek / Ollama / 自定义 API

## 代码架构

### 目录结构

```
app/                      # Next.js App Router
├── (auth)/              # 认证相关页面（登录/注册）
├── (dashboard)/         # 主应用页面
├── api/                 # REST API 路由（webhook）
├── layout.tsx           # 根布局
└── page.tsx             # 首页

components/              # React 组件
├── ui/                 # 基础 UI 组件（shadcn/ui）
├── animation/          # 动画组件
├── entries/            # 文章相关组件
├── layout/             # 布局组件（侧边栏、头部等）
└── notifications/      # 通知组件

server/                 # 服务端代码
├── api/                # REST API 路由
├── trpc/               # tRPC 设置和上下文

lib/                    # 工具库
├── rss/                # RSS 解析和订阅源管理
├── ai/                 # AI 服务抽象层
├── auth/               # 认证工具（JWT、密码、会话）
├── db.ts               # Prisma 客户端
└── utils.ts            # 通用工具函数

hooks/                  # 自定义 React Hooks

prisma/                 # 数据库
└── schema.prisma       # 数据库模型定义
```

### 双 API 架构

项目使用**双 API 架构**：

1. **tRPC** - 前后端内部通信的主要 API
   - 类型安全，端到端类型推导
   - 使用 SuperJSON 序列化
   - `protectedProcedure` 用于需要认证的操作
   - `publicProcedure` 用于公开操作

2. **REST API** - Webhook 和外部集成
   - 定义在 `server/api/` 中
   - 认证通过 JWT + Bearer Token 或 HTTP-only Cookies

### 认证架构

认证使用 **JWT + HTTP-only Cookies**：

```
登录流程：
用户提交表单 → server/api/auth.ts
    ↓
验证凭据 (lib/auth/password.ts)
    ↓
签发 JWT (lib/auth/jwt.ts)
    ↓
设置 Cookie (lib/auth/session.ts)
    ↓
tRPC Context 注入 userId (server/trpc/context.ts)
```

**重要**：
- JWT Secret 使用 `JWT_SECRET` 或 `NEXTAUTH_SECRET` 环境变量
- Token 有效期：7 天
- Cookie 名称：`session`（httpOnly, secure in production）
- 前端通过 `getSession()` 获取当前用户

### AI 服务架构

AI 服务使用**提供商模式**，支持多个 AI 提供商：

**配置**：通过 `AI_PROVIDER` 环境变量选择提供商
- `openai` - OpenAI GPT 模型
- `anthropic` - Anthropic Claude 模型
- `deepseek` - DeepSeek 模型
- `ollama` - 本地 Ollama 模型
- `custom` - 自定义 API（OpenAI 兼容格式）

**使用方式**：
```typescript
import { getDefaultAIService } from '@/lib/ai/client';

const aiService = getDefaultAIService();
const result = await aiService.analyzeArticle(content, {
  summary: true,
  keywords: true,
  category: true,
  sentiment: false,
  importance: true,
});
```

**提供商实现**：`lib/ai/client.ts`
- `OpenAIProvider` - OpenAI API
- `AnthropicProvider` - Anthropic API
- `DeepSeekProvider` - DeepSeek API（OpenAI 兼容）
- 嵌入向量生成使用 OpenAI `text-embedding-3-small`

### RSS 解析架构

RSS 解析使用 **模块化架构**：

**`lib/rss/parser.ts`** - RSS/Atom/JSON Feed 解析器
- 支持自定义字段解析
- 自动内容提取（cheerio）
- Feed 发现功能
- 验证和去重

**`lib/rss/feed-manager.ts`** - 订阅源管理器
- 单次/批量抓取
- HTTP 缓存支持（ETag, Last-Modified）
- 优先级调度
- 错误重试和监控
- 自动清理旧条目

### 订阅规则系统

规则在文章抓取后自动应用：

**匹配条件**：字段（标题/内容/作者/分类/标签/订阅源）+ 操作符（包含/不包含/等于/正则/在列表中）

**执行动作**：标记已读/加星标/归档/分配分类/添加标签/跳过处理

### 数据库模型核心关系

```
User (用户)
  ├── Feed[] (订阅源) - 多对一
  ├── Category[] (分类) - 多对一，支持层级（parentId）
  ├── ReadingHistory[] (阅读历史) - 阅读进度跟踪
  ├── ReadingSession[] (阅读会话) - 阅读行为追踪（停留时间、滚动深度）
  ├── UserPreference (用户偏好) - 主题权重、阅读偏好
  ├── SearchHistory[] (搜索历史)
  ├── Report[] (报告) - 日报/周报
  ├── Notification[] (通知)
  ├── ApiKey[] (API 密钥)
  └── SubscriptionRule[] (订阅规则)

Feed (订阅源)
  ├── Category (可选分类) - 多对一
  └── Entry[] (文章)

Entry (文章)
  ├── Feed (所属订阅源) - 多对一
  ├── contentHash (唯一标识，用于去重)

  # 基础 AI 字段
  ├── AI 字段 (aiSummary, aiKeywords, aiSentiment, aiCategory, aiImportanceScore)
  ├── 向量嵌入 (titleEmbedding, contentEmbedding) - 用于语义搜索

  # AI-Native 深度分析字段
  ├── aiOneLineSummary - 一句话总结
  ├── aiMainPoints - 主要观点 [{point, explanation, importance}]
  ├── aiKeyQuotes - 关键引用 [{quote, significance}]
  ├── aiScoreDimensions - 评分维度 {depth, quality, practicality, novelty}
  ├── aiAnalysisModel - 使用的模型组合
  ├── aiProcessingTime - 处理耗时(ms)
  ├── aiReflectionRounds - 反思轮数
  ├── aiAnalyzedAt - 深度分析时间

  # 初评字段（BestBlogs 改进）
  ├── aiPrelimIgnore - 是否忽略（低质内容）
  ├── aiPrelimReason - 主题描述
  ├── aiPrelimValue - 价值评分 1-5
  ├── aiPrelimSummary - 一句话总结
  ├── aiPrelimLanguage - 语言类型 'zh', 'en', 'other'
  ├── aiPrelimStatus - 初评状态 'pending', 'passed', 'rejected'
  ├── aiPrelimAnalyzedAt - 初评时间
  ├── aiPrelimModel - 初评使用的模型

  ├── ReadingHistory[] (阅读历史)
  ├── ReadingSession[] (阅读会话)
  ├── AIAnalysisQueue[] (AI 分析任务)
  ├── ReportEntry[] (报告关联)
  ├── ArticleRelation[] (文章关系 - 知识图谱)
  └── AnalysisFeedback[] (用户反馈)

ArticleRelation (文章关系)
  ├── sourceEntry - 源文章
  ├── targetEntry - 目标文章
  ├── relationType - 'similar', 'prerequisite', 'contradiction', 'extension'
  └── strength - 关系强度 0-1

AnalysisFeedback (分析反馈)
  ├── entry - 关联文章
  ├── summaryIssue - 摘要问题描述
  ├── tagSuggestions - 标签建议
  ├── rating - 用户评分 1-5
  ├── isHelpful - 是否有帮助
  └── isApplied - 是否已应用到分析
```

### 环境变量

完整的环境变量配置请参考 `.env.example` 文件。关键配置：

```env
# 数据库
DATABASE_URL=           # PostgreSQL 连接字符串
REDIS_URL=              # Redis 连接字符串（BullMQ 队列）

# 认证
JWT_SECRET=             # JWT 密钥（或 NEXTAUTH_SECRET）
NEXTAUTH_URL=           # 应用 URL

# AI 服务
AI_PROVIDER=            # openai | anthropic | deepseek | gemini | ollama | custom
AI_MODEL=               # 自定义模型名称
OPENAI_API_KEY=         # OpenAI API Key
ANTHROPIC_API_KEY=      # Anthropic API Key
DEEPSEEK_API_KEY=       # DeepSeek API Key
GEMINI_API_KEY=         # Google Gemini API Key
CUSTOM_API_BASE_URL=    # 自定义 API 地址
CUSTOM_API_KEY=         # 自定义 API Key
CUSTOM_API_MODEL=       # 自定义 API 模型

# AI-Native 配置（可选，使用默认值即可）
PRELIMINARY_MIN_VALUE=  # 初步评估最低分数（默认 3）
REFLECTION_ENABLED=     # 是否启用反思引擎（默认 true）
MAX_REFLECTION_ROUNDS=  # 最大反思轮数（默认 2）

# 自定义 API 示例（支持国内 AI 服务）
# Moonshot（月之暗面）
CUSTOM_API_BASE_URL="https://api.moonshot.cn/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="moonshot-v1-8k"
AI_PROVIDER="custom"

# 通义千问
CUSTOM_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="qwen-plus"

# 智谱 GLM
CUSTOM_API_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
CUSTOM_API_KEY="xxx"
CUSTOM_API_MODEL="glm-4-plus"
```

## 前端 tRPC 调用

前端使用 tRPC React Query 集成：

```typescript
// 调用公开 API
const { data } = api.auth.login.useMutation({ /* ... */ });

// 调用需要认证的 API
const { data: feeds } = api.feeds.list.useQuery();

// Mutation 操作
const markAsRead = api.entries.markAsRead.useMutation();
```

## 后台任务调度

项目使用 **BullMQ + Redis** 处理异步任务：

- **AI 分析队列**：`lib/ai/queue.ts` - AIAnalysisQueue 类
- **任务调度器**：定时抓取订阅源内容
- **队列状态 API**：`app/api/scheduler/status/route.ts` 和 `app/api/scheduler/trigger/route.ts`

**启动队列处理器**：
```typescript
import { getAIQueue } from '@/lib/ai/queue';

const queue = getAIQueue();
queue.start(); // 启动后台处理
queue.stop();  // 停止处理
```

## Docker 部署

项目包含 Docker Compose 配置（`docker-compose.yml`）：
- **PostgreSQL 数据库** - 用户数据 16-alpine
- **Redis 缓存和队列** - BullMQ 任务队列 7-alpine
- **应用服务** - Next.js standalone 模式
- **初始化服务** - 自动运行数据库迁移和种子数据

```bash
# 使用 Docker 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

**Docker 默认配置**：
- PostgreSQL: `rss_easy:rss_easy_password@localhost:5432/rss_easy`
- Redis: `localhost:6379`
- 应用: `http://localhost:3000`

## 部署注意事项

### Next.js Standalone 输出

项目配置为 `output: 'standalone'` 模式（`next.config.ts`），这意味着：
- 构建后生成 `.next/standalone` 目录
- 该目录包含运行应用所需的最小依赖
- Docker 使用此模式构建最小化镜像

**重要**：运行 `npm run db:push` 或数据库迁移后，必须运行 `npm run db:generate` 重新生成 Prisma Client。

### 环境变量优先级

1. 用户级别 AI 配置（`User.aiConfig`）- 最高优先级
2. 环境变量（`AI_PROVIDER`、`AI_MODEL` 等）
3. 默认值（OpenAI gpt-4o）

## 开发注意事项

### 添加新的 tRPC 路由

tRPC 路由定义在 `server/api/` 目录中：
- `server/trpc/init.ts` - tRPC 初始化、中间件、router/procedure 导出
- `server/trpc/context.ts` - tRPC 上下文（db, userId, session）
- `server/api/index.ts` - 主路由入口，合并所有子路由

添加新路由：
1. 在 `server/api/` 中创建路由文件（如 `my-feature.ts`）
2. 使用 `publicProcedure` 或 `protectedProcedure` 定义 procedure
3. 在 `server/api/index.ts` 中导入并合并路由：
```typescript
import { myFeatureRouter } from './my-feature';

export const appRouter = router({
  // ...
  myFeature: myFeatureRouter,
});
```

**现有 tRPC 路由**：
- `auth` - 认证（登录/注册）
- `feeds` - 订阅源管理
- `entries` - 文章操作
- `categories` - 分类管理
- `search` - 搜索功能
- `reports` - 报告生成
- `settings` - 用户设置
- `rules` - 订阅规则
- `notifications` - 通知管理
- `ai` - AI 功能
- `analytics` - 用户行为追踪和偏好学习（AI-Native）
- `recommendations` - 个性化推荐
- `preliminary` - 初步评估队列（AI-Native）

### 数据库变更

1. 修改 `prisma/schema.prisma`
2. 开发环境：`npm run db:push` + `npm run db:generate`
3. 生产环境：`npm run db:migrate` + `npm run db:generate`

**重要**：修改 schema 后务必重新生成 Prisma Client，否则 tRPC Context 和其他使用数据库的地方会报错。

### AI 功能集成

- 使用 `getDefaultAIService()` 获取默认 AI 服务实例
- AI 分析结果通过 BullMQ 队列异步处理
- 向量嵌入用于语义搜索（pgvector）

### 搜索功能

- **全文搜索**：PostgreSQL 全文搜索
- **语义搜索**：pgvector 向量相似度搜索
- 搜索历史保存在 SearchHistory 模型

## AI-Native 智能分析系统

项目采用**双层分析架构**，优化成本和质量：

### 分析流程

```
文章抓取 → 初步评估 (PreliminaryEvaluator)
    ↓ (通过价值阈值)
深度分析队列 → SmartAnalyzer (根据长度选择策略)
    ↓
反思引擎 → 反馈收集 → 质量优化
```

### 核心组件

**`lib/ai/smart-analyzer.ts`** - 智能分析器
- 短文章 (≤6000字符)：直接分析
- 中等文章 (6000-12000字符)：分段分析
- 长文章 (>12000字符)：分段分析 + 结果合并

**`lib/ai/preliminary-evaluator.ts`** - 初步评估器
- 快速评估文章价值
- 过滤低质量内容
- 节省深度分析成本

**`lib/ai/model-selector.ts`** - 模型选择器
- 根据语言选择最佳模型
- 中文：DeepSeek（成本低、质量好）
- 英文：GPT-4o-mini（速度快）
- 其他：GPT-4o-mini

**`lib/ai/analysis/reflection-engine.ts`** - 反思引擎
- 自动检查分析质量
- 迭代改进结果
- 支持多轮反思

**`lib/ai/feedback-engine.ts`** - 反馈引擎
- 收集用户反馈
- 调整评分策略
- 个性化优化

### 队列系统

**`lib/queue/preliminary-processor.ts`** - 初步评估队列
- 快速处理新文章
- 价值评分
- 决策是否深度分析

**`lib/queue/deep-analysis-processor.ts`** - 深度分析队列
- 完整 AI 分析
- 支持优先级
- 失败重试

### 队列管理命令

```bash
# 查看队列状态
npm run queue status

# 添加单个分析任务
npm run queue add <entryId> [priority]

# 批量添加任务
npm run queue add-batch [limit] [priority]

# 查看任务状态
npm run queue job <jobId>

# 重试失败任务
npm run queue retry [limit]
```

### 成本和性能监控

```bash
# 生成成本和性能分析报告
npm run cost-analysis
```

报告包括：
- 总体统计（处理数、成功率、平均时间、成本）
- 按模型/语言/阶段分组统计
- 成本优化建议
- 性能指标（P50/P95/P99）
- 模型对比分析
- 性价比分析

## 测试账号

- 邮箱: `test@example.com`
- 密码: `password123`
