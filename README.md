<div align="center">

<img src="public/logo.png" alt="RSS-Post Logo" width="120" height="120">

# RSS-Post

**AI-Native 智能资讯处理引擎**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

</div>

---

## 项目简介

RSS-Post 是一款 AI 驱动的智能 RSS 阅读器，专注于解决信息过载问题。通过双层 AI 分析架构，自动筛选高价值内容、提取核心观点、生成个性化推荐，帮助用户从海量资讯中高效获取知识。

**核心能力**：
- **智能筛选** - 初评阶段快速过滤低质内容，节省 70%+ 阅读时间
- **深度分析** - 一句话总结、核心观点、关键引用、五维质量评分
- **个性化推荐** - 基于阅读行为构建用户画像，越用越精准
- **知识报告** - AI 自动生成日报/周报，按主题聚合整理

---

## 核心特性

### 双层 AI 分析

采用成本与质量平衡的双路径设计：

```
新文章 → 初评（低成本快速筛选）→ 低质内容过滤
              ↓ 通过价值阈值
         深度分析队列 → 智能分段处理 → 反思优化 → 结果存储
```

- **初评**：语言检测、价值评分（1-5）、一句话摘要，成本约 $0.001/篇
- **深度分析**：核心观点提取、关键引用、五维评分（深度/质量/实用性/新颖性/相关度）
- **反思引擎**：自动检查分析结果的全面性、准确性、一致性，迭代优化

### 语义搜索

基于 pgvector 向量数据库实现语义检索，理解搜索意图而非简单关键词匹配。支持按时间、分类、标签、阅读状态等多维度过滤。

### 智能报告

**报告生成**：
- 日报/周报自动生成，按分类/主题聚合文章
- AI 生成结构化内容：热度概览、分领域详情、趋势小结
- 支持手动触发或定时调度

**格式导出**：
- Markdown / HTML / JSON / PDF 多格式支持
- PDF 自动排版，包含标题、目录、分页

**邮件推送**：
- 报告生成后自动发送邮件
- PDF 作为附件发送
- 支持 SMTP 配置（QQ邮箱、163邮箱、Resend 等）

**阅读统计**：
- 文章数量、订阅源数量、分类分布
- 热门话题 Top 10
- 重要性评分排序

### 自动化规则

基于条件（标题/内容/作者/分类）自动执行动作（标记已读/加星标/分配分类/添加标签），实现个性化内容过滤。

### 多模型支持

支持 OpenAI、Anthropic、DeepSeek、Ollama 及任意 OpenAI 兼容 API，可在界面中灵活切换。

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

### 方式一：Docker 快速部署（推荐）

```bash
# 克隆项目
git clone https://github.com/BlkSword/RSS-Post.git
cd RSS-Post

# 启动所有服务（数据库 + Redis + 应用）
docker compose up -d

# 查看日志
docker compose logs -f app

# 停止服务
docker compose down
```

访问 http://localhost:8915 即可使用。

**说明**：此方式适合快速体验，使用默认配置。生产环境建议使用方式四。

### 方式二：Docker 开发环境

适合开发调试，支持代码热重载：

```bash
# 首次构建
docker compose -f docker-compose.dev.yml build

# 启动开发环境
docker compose -f docker-compose.dev.yml up -d

# 查看日志
docker compose -f docker-compose.dev.yml logs -f app
```

**开发环境优势**：
- 代码修改实时生效，无需重新构建镜像
- 使用 Turbopack 加速编译
- 挂载本地目录，支持热重载

### 方式三：本地开发

仅启动基础设施，本地运行应用：

```bash
# 1. 只启动 PostgreSQL 和 Redis
docker compose -f docker-compose.dev.yml up -d postgres redis

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，配置数据库连接（已由 Docker 启动）

# 4. 初始化数据库
npm run db:generate && npm run db:push && npm run db:seed

# 5. 启动开发服务器
npm run dev

# 6. 启动 AI 队列处理器（另开终端）
npm run worker:preliminary    # 初评 Worker
npm run worker:deep-analysis  # 深度分析 Worker
```

### 方式四：生产环境部署

**推荐用于正式环境**，包含资源限制、自动备份、日志轮转等：

```bash
# 创建 .env 文件并配置必要的环境变量
cp .env.example .env
# 编辑 .env，设置强密码和 API Key

# 使用生产配置启动
docker compose -f docker-compose.prod.yml up -d --build

# 查看应用日志
docker compose -f docker-compose.prod.yml logs -f app
```

**生产环境特性**：
- 资源限制（CPU/内存）
- 健康检查
- 自动备份（每天凌晨 2 点，存储到 `backups/` 目录）
- 日志轮转
- Redis 密码保护
- 网络隔离

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
DATABASE_URL="postgresql://rss_post:password@localhost:5432/rss_post"

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
curl http://localhost:8915/api/health

# 队列状态检查
curl http://localhost:8915/api/scheduler/status
```

### 数据库备份与恢复

备份文件存储在项目根目录的 `backups/` 文件夹中。

```bash
# 手动备份
docker exec rss-post-backup sh -c "
  DATE=\$(date +%Y%m%d_%H%M%S) &&
  pg_dump -U rss_post -h postgres rss_post | gzip > /backups/backup_\$DATE.sql.gz
"

# 查看备份文件
ls -lh backups/

# 恢复备份
gunzip -c backups/backup_20240115_020000.sql.gz | docker exec -i rss-post-db psql -U rss_post -d rss_post
```

---
