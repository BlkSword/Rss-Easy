<div align="center">

<img src="public/logo.png" alt="Rss-Easy Logo" width="120" height="120">

# Rss-Easy

**智能 RSS 资讯聚合平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

</div>

---

## 项目简介

Rss-Easy 是一款 **AI 驱动**的现代化 RSS 阅读器，致力于解决信息过载问题。通过**双层智能分析架构**，自动筛选高价值内容、生成深度摘要、提取核心观点，让你用最少的时间获取最有价值的信息。

**核心价值**：
- 🎯 **智能过滤** - 初步评估自动过滤低质内容，节省 60%+ 阅读时间
- 🧠 **深度分析** - 一句话总结、主要观点、关键引用、多维度质量评分
- 🔍 **语义搜索** - 基于向量相似度的智能搜索，找内容不再依赖关键词
- 📊 **智能报告** - AI 自动生成日报/周报，快速回顾阅读精华

---

## 核心特性

### AI 智能增强
- **双层分析架构** - 初步评估过滤低质内容，深度分析提取核心价值
- **智能摘要** - 一句话总结、主要观点、关键引用、多维度评分
- **反思引擎** - 自动检查分析质量，迭代改进结果
- **多模型支持** - OpenAI / Anthropic / DeepSeek / 自定义 API

### 搜索功能
- **语义搜索** - 基于 pgvector 向量相似度的智能搜索
- **全文搜索** - PostgreSQL 全文索引，快速检索

### 自动化
- **订阅规则** - 基于条件自动分类、标记、过滤文章
- **智能报告** - AI 生成日报/周报，支持 PDF 导出
- **定时抓取** - 自动抓取订阅源新内容

### 用户体验
- **PWA 支持** - 可安装、离线阅读
- **响应式设计** - 完美支持桌面和移动端
- **键盘快捷键** - 高效的键盘导航

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| UI | Tailwind CSS 4 + Ant Design 6 + shadcn/ui |
| API | tRPC (类型安全) + REST |
| 数据库 | PostgreSQL 16 + Prisma 6 + pgvector |
| 队列 | Redis + BullMQ 5 |
| 认证 | JWT (jose) + HTTP-only Cookies |
| AI | OpenAI / Anthropic / DeepSeek / Custom |

---

## 快速开始

### 方式一：Docker 一键启动（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问 http://localhost:3000 即可使用。

**零配置启动**：无需修改任何配置，密钥自动生成，AI 配置可在应用界面中设置。

### 方式二：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化数据库
npm run db:generate && npm run db:push && npm run db:seed

# 4. 启动开发服务器
npm run dev

# 5. 启动 AI 队列处理器（另一个终端）
npm run worker:preliminary
npm run worker:deep-analysis
```

---

## 项目架构

```
app/                    # Next.js App Router
├── (auth)/            # 认证页面（登录/注册）
├── (dashboard)/       # 主应用页面
└── api/               # REST API（webhook/健康检查）

server/                 # 服务端代码
├── api/               # tRPC 路由（auth, feeds, entries, ai...）
└── trpc/              # tRPC 配置和上下文

lib/                    # 核心库
├── ai/                # AI 服务（多提供商支持）
│   ├── client.ts      # AI 提供商实现
│   ├── smart-analyzer.ts    # 智能分析器
│   └── preliminary-evaluator.ts  # 初步评估器
├── rss/               # RSS 解析和订阅管理
├── auth/              # 认证工具（JWT、密码、会话）
├── queue/             # BullMQ 队列处理器
└── db.ts              # Prisma 客户端

components/             # React 组件
├── ui/                # 基础 UI（shadcn/ui）
├── entries/           # 文章组件
└── layout/            # 布局组件

prisma/                 # 数据库
└── schema.prisma      # 数据模型定义
```

### 核心数据模型

```
User ─┬─ Feed[] ─── Entry[]
      ├─ Category[]
      ├─ Report[]
      ├─ SubscriptionRule[]
      └─ ApiKey[]

Entry ─┬─ AI 字段（摘要、关键词、评分...）
       ├─ 向量嵌入（语义搜索）
       ├─ 初评字段（价值评分、语言检测）
       └─ 深度分析（主要观点、关键引用）
```

### AI 分析流程

```
文章抓取 → 初步评估（快速筛选）
              ↓ 通过价值阈值
         深度分析队列 → SmartAnalyzer
              ↓
         反思引擎 → 质量优化 → 结果存储
```

---

## 开发命令

```bash
# 开发
npm run dev              # 启动开发服务器（Turbopack）
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # ESLint 检查

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 schema（开发）
npm run db:migrate       # 数据库迁移（生产）
npm run db:studio        # Prisma Studio
npm run db:seed          # 填充初始数据

# AI 队列
npm run worker:preliminary    # 启动初步评估 Worker
npm run worker:deep-analysis  # 启动深度分析 Worker
npm run queue                 # 队列管理工具
npm run cost-analysis         # 成本分析报告
```

---

## 环境变量

详见 [.env.example](.env.example)，关键配置：

```env
# 数据库
DATABASE_URL="postgresql://rss_easy:password@localhost:5432/rss_easy"
REDIS_URL="redis://localhost:6379"

# 认证（Docker 自动生成）
JWT_SECRET="your-secret-key"

# AI 服务（可在界面中配置）
AI_PROVIDER="openai"        # openai | anthropic | deepseek | custom
OPENAI_API_KEY="sk-xxx"
```

### 国内 AI 服务配置

```env
# Moonshot（月之暗面）
AI_PROVIDER="custom"
CUSTOM_API_BASE_URL="https://api.moonshot.cn/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="moonshot-v1-8k"

# 通义千问
CUSTOM_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="qwen-plus"

# 智谱 GLM
CUSTOM_API_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
CUSTOM_API_KEY="xxx"
CUSTOM_API_MODEL="glm-4-plus"
```

---

## 生产部署

### Docker Compose

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f app
```

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 数据库备份

```bash
# 备份
docker-compose exec db pg_dump -U rss_easy rss_easy | gzip > backup.sql.gz

# 恢复
gunzip -c backup.sql.gz | docker-compose exec -T db psql -U rss_easy rss_easy
```

---

