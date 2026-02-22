<div align="center">

<img src="public/logo.png" alt="Rss-Easy Logo" width="120" height="120">

# Rss-Easy

**AI-Native 智能资讯处理引擎**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

</div>

---

## 项目简介

Rss-Easy 是一款面向深度阅读者的智能资讯聚合平台，旨在通过 AI 技术将碎片化的信息流转化为结构化的知识资产


**核心价值**：
- 🎯 **智能初评** - 轻量级 AI 快速筛选，过滤低质、重复内容
- 🧠 **深度分析** - 一句话总结、核心观点提取、关键引用、五维质量评分
- 🔄 **反思优化** - 多轮自我审查，持续提升分析质量
- 👤 **个性推荐** - 基于阅读行为构建用户画像，越用越懂你
- 📊 **智能报告** - AI 自动生成日报/周报，按主题聚合整理

---

## 核心特性

### AI 双层分析架构

采用 **双路径设计**：

```
文章抓取 → 初步评估（快速筛选低质内容）
              ↓ 通过价值阈值
         深度分析队列 → SmartAnalyzer（短/中/长文分别处理）
              ↓
         反思引擎 → 质量优化 → 个性化评分 → 结果存储
```

- **初评阶段**：语言检测、价值评分（1-5分）、快速摘要、低质内容过滤
- **深度分析**：一句话总结、主要观点（带解释和重要性）、关键引用、五维评分（深度/质量/实用性/新颖性/相关度）
- **反思引擎**：自动检查全面性、准确性、深度性、一致性、客观性，迭代优化结果

### 个性化知识推荐

- **用户画像**：主题权重、阅读深度偏好、平均完成率、多样性评分
- **五维评分**：内容深度、质量、实用性、新颖性、个人相关度
- **推荐理由**：AI 解释为什么推荐这篇文章

### 智能报告系统

- **日报/周报**：AI 按主题聚合整理，生成结构化报告
- **多格式导出**：Markdown / HTML / PDF
- **定时推送**：邮件自动发送，打造个人专属资讯简报
- **阅读统计**：分类分布、热门话题、阅读趋势

### 对话式 AI 助手

- **RAG 问答**：基于订阅内容的智能问答
- **趋势分析**：发现近期热门话题和发展趋势
- **阅读建议**：根据个人偏好推荐今日必读

### 高级搜索

- **语义搜索**：基于 pgvector 向量相似度，理解意图而非匹配关键词
- **全文检索**：PostgreSQL 全文索引，快速定位内容
- **智能过滤**：按时间、分类、标签、阅读状态筛选

### 自动化工作流

- **订阅规则**：基于条件自动分类、标记、过滤、分配文章
- **定时抓取**：智能调度，支持 HTTP 缓存（ETag/Last-Modified）
- **优先级队列**：高价值内容优先处理

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4 + Ant Design 6 + shadcn/ui + Framer Motion |
| API | tRPC (类型安全) + REST (webhook/外部集成) |
| 数据库 | PostgreSQL 16 + Prisma 6 + pgvector |
| 队列 | Redis + BullMQ 5 |
| 认证 | JWT (jose) + HTTP-only Cookies + CSRF 保护 |
| AI | OpenAI / Anthropic / DeepSeek / Ollama / 自定义 API |
| PWA | Service Worker + Web App Manifest |

---

## 快速开始

### 方式一：Docker 一键启动（推荐）

```bash
# 克隆项目
git clone https://github.com/BlkSword/Rss-Easy.git
(国内：git clone https://gh-proxy.org/https://github.com/BlkSword/Rss-Easy.git)
cd Rss-Easy

# 启动所有服务（数据库 + Redis + 应用）
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

访问 http://localhost:3000 即可使用。

**零配置启动**：无需修改任何配置，首次启动自动生成密钥，AI 配置可在应用设置界面中完成。

### 方式二：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，配置数据库和 Redis 连接

# 3. 初始化数据库
npm run db:generate && npm run db:push && npm run db:seed

# 4. 启动开发服务器
npm run dev

# 5. 启动 AI 队列处理器（需要另开终端）
npm run worker:preliminary    # 初评 Worker
npm run worker:deep-analysis  # 深度分析 Worker
```

---

## 项目架构

```
app/                    # Next.js App Router
├── (auth)/            # 认证页面（登录/注册/找回密码）
├── (dashboard)/       # 主应用页面
│   ├── ai/           # AI 助手页面
│   ├── feeds/        # 订阅源管理
│   ├── entries/      # 文章阅读
│   ├── reports/      # 报告中心
│   ├── rules/        # 订阅规则
│   └── settings/     # 系统设置
├── api/              # REST API（webhook/健康检查/OPML）
└── page.tsx          # 首页（阅读器布局）

server/                 # 服务端代码
├── api/              # tRPC 路由定义
│   ├── auth.ts       # 认证相关
│   ├── entries.ts    # 文章 CRUD
│   ├── feeds.ts      # 订阅源管理
│   ├── ai.ts         # AI 服务接口
│   ├── reports.ts    # 报告生成
│   └── ...
└── trpc/             # tRPC 配置和上下文

lib/                    # 核心库
├── ai/                # AI 服务层
│   ├── client.ts             # AI 提供商抽象
│   ├── smart-analyzer.ts     # 智能分析器（短/中/长文处理）
│   ├── preliminary-evaluator.ts  # 初评器
│   ├── analysis/
│   │   ├── reflection-engine.ts  # 反思优化引擎
│   │   └── segmented-analyzer.ts # 分段分析器
│   └── scoring/
│       └── personal-scorer.ts    # 个性化评分系统
├── rss/               # RSS 解析和订阅管理
│   ├── parser.ts      # RSS/Atom/JSON Feed 解析
│   └── feed-manager.ts # 订阅源管理器
├── queue/             # BullMQ 队列处理器
│   ├── preliminary-processor.ts   # 初评队列
│   └── deep-analysis-processor.ts # 深度分析队列
├── reports/           # 报告生成服务
├── auth/              # 认证工具（JWT/密码/会话）
└── db.ts              # Prisma 客户端

components/             # React 组件
├── ui/               # 基础 UI（shadcn/ui）
├── animation/        # 动画组件
├── entries/          # 文章相关组件
├── layout/           # 布局组件（侧边栏/头部/阅读器）
└── mobile/           # 移动端专用组件

prisma/                 # 数据库
└── schema.prisma     # 16+ 数据模型定义
```

### 核心数据模型

```
User ─┬─ Feed[] ─── Entry[]
      ├─ Category[]
      ├─ Report[]
      ├─ ReportSchedule[]
      ├─ SubscriptionRule[]
      ├─ ReadingSession[]  # 阅读行为追踪
      ├─ UserPreference    # 用户画像
      └─ ApiKey[]

Entry ─┬─ 基础字段（标题/内容/作者/时间）
       ├─ AI 增强字段（摘要/关键词/情感/分类）
       ├─ 向量嵌入（语义搜索）
       ├─ 初评字段（价值评分/语言/状态）
       ├─ 深度分析（一句话总结/主要观点/关键引用/评分维度）
       └─ ArticleRelation[] # 文章关系图谱
```

---

## 开发命令

```bash
# 开发
npm run dev              # 启动开发服务器（Turbopack）
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # ESLint 检查

# 测试
npm run test             # 运行测试
npm run test:watch       # 监听模式运行测试

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 schema 变更（开发环境）
npm run db:migrate       # 数据库迁移（生产环境）
npm run db:studio        # 打开 Prisma Studio
npm run db:seed          # 填充初始数据

# AI 队列 Worker
npm run worker:preliminary    # 启动初评 Worker
npm run worker:deep-analysis  # 启动深度分析 Worker
npm run queue                 # 队列管理工具

# 测试与分析
npm run test:preliminary      # 测试初评功能
npm run test:deep-analysis    # 测试深度分析
npm run test:smart-analyzer   # 测试智能分析器
npm run cost-analysis         # 成本分析报告
```

---

## 环境变量

详见 [.env.example](.env.example)，关键配置：

```env
# 数据库（必需）
DATABASE_URL="postgresql://rss_easy:password@localhost:5432/rss_easy"

# Redis（必需，用于队列）
REDIS_URL="redis://localhost:6379"

# 认证（Docker 自动生成，手动部署时需设置）
JWT_SECRET="your-secret-key-min-32-characters-long"

# AI 服务（可选，可在界面中配置）
AI_PROVIDER="openai"        # openai | anthropic | deepseek | ollama | custom
OPENAI_API_KEY="sk-xxx"
OPENAI_MODEL="gpt-4o"
```

### 国内 AI 服务配置示例

```env
# DeepSeek
AI_PROVIDER="deepseek"
DEEPSEEK_API_KEY="sk-xxx"
DEEPSEEK_MODEL="deepseek-chat"

# Moonshot（月之暗面）
AI_PROVIDER="custom"
CUSTOM_API_BASE_URL="https://api.moonshot.cn/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="moonshot-v1-8k"

# 通义千问
CUSTOM_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="qwen-plus"
```

---

## 生产部署

### Docker Compose 生产部署

```bash
# 使用生产配置
docker-compose -f docker-compose.prod.yml up -d --build

# 查看应用日志
docker-compose logs -f app

# 查看 Worker 日志
docker-compose logs -f preliminary-worker
docker-compose logs -f deep-analysis-worker
```

### 健康检查

```bash
# 应用健康检查
curl http://localhost:3000/api/health

# 队列状态检查
curl http://localhost:3000/api/scheduler/status
```

### 数据库备份与恢复

```bash
# 备份
docker-compose exec db pg_dump -U rss_easy rss_easy | gzip > backup_$(date +%Y%m%d).sql.gz

# 恢复
gunzip -c backup_20240115.sql.gz | docker-compose exec -T db psql -U rss_easy rss_easy
```

---
