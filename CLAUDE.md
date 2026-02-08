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

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 schema 变更到数据库（开发环境）
npm run db:migrate       # 运行数据库迁移（生产环境）
npm run db:studio        # 打开 Prisma Studio
npm run db:seed          # 填充初始数据

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
  ├── AI 字段 (aiSummary, aiKeywords, aiSentiment, aiCategory, aiImportanceScore)
  ├── 向量嵌入 (titleEmbedding, contentEmbedding) - 用于语义搜索
  ├── ReadingHistory[] (阅读历史)
  ├── AIAnalysisQueue[] (AI 分析任务)
  └── ReportEntry[] (报告关联)
```

### 环境变量

```env
# 数据库
DATABASE_URL=           # PostgreSQL 连接字符串
REDIS_URL=              # Redis 连接字符串（BullMQ 队列）

# 认证
JWT_SECRET=             # JWT 密钥（或 NEXTAUTH_SECRET）

# AI 服务
AI_PROVIDER=            # openai | anthropic | deepseek | ollama | custom
AI_MODEL=               # 自定义模型名称
OPENAI_API_KEY=         # OpenAI API Key
ANTHROPIC_API_KEY=      # Anthropic API Key
DEEPSEEK_API_KEY=       # DeepSeek API Key
CUSTOM_API_BASE_URL=    # 自定义 API 地址
CUSTOM_API_KEY=         # 自定义 API Key
CUSTOM_API_MODEL=       # 自定义 API 模型
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
- PostgreSQL 数据库
- Redis 缓存和队列
- 应用服务

```bash
# 使用 Docker 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

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

## 测试账号

- 邮箱: `test@example.com`
- 密码: `password123`
