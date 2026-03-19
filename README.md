# RSS-Post

> 🤖 AI 驱动的智能 RSS 信息聚合平台

RSS-Post 是一个智能信息聚合工具，旨在将碎片化的信息流转化为结构化的知识资产。通过 AI 智能分析、双层评估引擎和自动化规则，帮你从海量信息中筛选出真正有价值的内容。

项目包含两个部分：

- **🌐 Web 平台** (`/`) — 基于 Next.js 16 + React 19 的全栈 Web 应用（原版）
- **🖥️ CLI 工具** (`/cli`) — 基于 Go 的终端版本，精简高效，单二进制运行

---

## 🌐 Web 平台

### ✨ 核心特性

**Feed 管理**
- RSS 2.0 / Atom / JSON Feed 多格式支持
- OPML 批量导入导出
- 自动发现和补全订阅源信息（标题、描述、图标）
- 分类管理（支持多级嵌套分类）
- Feed 自动抓取 + 定时调度

**AI 智能分析（双层引擎）**
- **预筛选评估** — 用低成本模型快速过滤低价值文章（节省 API 费用）
- **深度分析** — 对高价值文章进行深度解析：摘要、要点、标签、多维评分
- **反思引擎** — 对分析结果进行二次校验，提升准确度
- **多模型支持** — OpenAI / Anthropic / DeepSeek / Gemini / Ollama / 自定义 API（OpenAI 兼容）
- **语言分支** — 根据文章语言自动选择最优模型组合（中/英/其他）
- **智能分段** — 短文直分析、长文分段分析，根据内容长度自动选择策略

**文章浏览**
- 沉浸式阅读体验，Framer Motion 流畅动画
- AI 评分、标签、摘要一目了然
- 已读/未读/收藏状态管理
- 阅读历史追踪

**搜索**
- 关键词搜索 + AI 标签语义搜索
- 搜索历史记录
- 加权排序（标题 > 标签 > 摘要 > 内容）

**智能报告**
- 自动生成日报 / 周报（Markdown 格式）
- AI 生成总结与趋势分析
- 定时邮件推送（可选）
- 支持自定义报告模板

**自动化规则**
- 基于关键词、标签、AI 评分等条件自动分类
- 自动标记已读、收藏、归档
- 自定义触发条件和执行动作

**系统功能**
- JWT 认证 + HTTP-only Cookies
- 用户个人设置（偏好、界面、通知）
- 管理员面板（系统设置、数据管理、日志查看）
- API Key 管理（外部集成）
- 通知系统

### 🏗️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4 + Ant Design 6 + shadcn/ui + Framer Motion |
| API | tRPC + REST |
| 数据库 | PostgreSQL 16 + Prisma 6 + pgvector |
| 队列 | Redis 7 + BullMQ 5 |
| 认证 | JWT (jose) + HTTP-only Cookies |
| AI | 多模型适配（OpenAI / Anthropic / DeepSeek / Gemini / Ollama / Custom） |
| 部署 | Docker + Docker Compose |

### 🏛️ 架构

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ 前端页面  │  │ tRPC API │  │  REST API (Cron) │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────┤
│                    业务逻辑层                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │ RSS  │ │  AI  │ │搜索  │ │报告  │ │ 邮件推送  │  │
│  │ 引擎 │ │ 引擎 │ │ 引擎 │ │ 引擎 │ │          │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘  │
├─────────────────────────────────────────────────────┤
│                    数据层                            │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ PostgreSQL   │  │    Redis     │                 │
│  │ (Prisma ORM) │  │ (BullMQ 队列)│                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘

后台 Worker (独立容器):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Feed Discovery│ │ Preliminary  │ │Deep Analysis │
│  Worker      │ │  Worker      │ │  Worker      │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 🚀 快速开始

#### 方式一：Docker 一键部署（推荐）

```bash
# 克隆项目
git clone https://github.com/BlkSword/RSS-Post.git
cd RSS-Post

# 复制环境变量
cp .env.example .env

# 一键启动（自动检测内存并优化构建参数）
./start.sh
```

启动后访问 `http://localhost:8915`，默认账号：`test@example.com` / `password123`

#### 方式二：预构建镜像（快速部署）

```bash
# 使用 GitHub Actions 构建的镜像（无需本地构建）
./deploy-prebuilt.sh
```

#### 方式三：本地开发

```bash
# 启动数据库和 Redis
pnpm run dev:up

# 初始化数据库
pnpm run dev:init

# 启动开发服务器
pnpm run dev

# 启动 Worker（新终端）
pnpm run worker:feed-discovery
```

### ⚙️ 配置说明

核心配置在 `.env` 文件中（参考 [.env.example](.env.example)）：

**必需配置**
```env
# 应用 URL（部署后改为实际域名）
APP_URL=http://localhost:8915
NEXTAUTH_URL=http://localhost:8915

# 安全密钥（生产环境必须替换！）
JWT_SECRET="你的随机密钥-至少32字符"
NEXTAUTH_SECRET="你的随机密钥-至少32字符"
ENCRYPTION_KEY="你的随机密钥-32字符"
CRON_SECRET="你的随机密钥-至少32字符"
```

**AI 配置**（启动后也可在设置界面中配置）
```env
# 选择 AI 提供商
AI_PROVIDER="openai"  # openai | anthropic | deepseek | ollama | custom

# 对应的 API Key
OPENAI_API_KEY="sk-xxx"
# 或
ANTHROPIC_API_KEY="sk-ant-xxx"
# 或
DEEPSEEK_API_KEY="sk-xxx"
```

**自定义 AI 模型**（OpenAI 兼容 API）
```env
AI_PROVIDER="custom"
CUSTOM_API_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
CUSTOM_API_KEY="your-key"
CUSTOM_API_MODEL="glm-4"
```

**可选配置**
```env
# 邮件推送（日报/周报）
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASSWORD="your-smtp-key"
SMTP_FROM_EMAIL="noreply@your-domain.com"

# 后台调度器（Feed 抓取、AI 分析、文章清理）
SCHEDULER_AUTO_START="true"
```

详细配置参考 [.env.ai-native.example](.env.ai-native.example)（AI Native 模式：按语言分支配置不同模型）。

### 📁 项目结构

```
├── app/                    # Next.js App Router 页面
│   ├── auth/               # 登录/注册
│   ├── entries/            # 文章列表/详情
│   ├── feeds/              # 订阅源管理
│   ├── categories/         # 分类管理
│   ├── search/             # 搜索
│   ├── reports/            # 报告
│   ├── starred/            # 收藏
│   ├── unread/             # 未读
│   ├── archive/            # 归档
│   ├── rules/              # 自动化规则
│   ├── notifications/      # 通知
│   ├── settings/           # 设置（AI/邮件/API/安全/偏好）
│   └── profile/            # 个人资料
├── components/             # React 组件
│   ├── entries/            # 文章相关组件
│   ├── layout/             # 布局组件
│   ├── providers/          # Context Provider
│   ├── ui/                 # 通用 UI 组件
│   └── mobile/             # 移动端适配
├── lib/                    # 核心业务逻辑
│   ├── ai/                 # AI 分析引擎
│   ├── auth/               # 认证逻辑
│   ├── cache/              # 缓存层
│   ├── db.ts               # 数据库连接
│   ├── email/              # 邮件服务
│   ├── jobs/               # 后台任务
│   ├── notifications/      # 通知系统
│   ├── opml/               # OPML 解析
│   ├── queue/              # BullMQ 队列
│   ├── reports/            # 报告生成
│   ├── rss/                # RSS 解析引擎
│   ├── rules/              # 自动化规则
│   ├── search/             # 搜索引擎
│   └── trpc/               # tRPC Router
├── prisma/                 # 数据库 Schema + 迁移
├── scripts/                # 工具脚本
├── server/                 # 服务端逻辑
├── docs/                   # 额外文档
│   ├── DOCKER-MEMORY-OPTIMIZATION.md
│   ├── RSS-PARSER-ENHANCEMENTS.md
│   └── worker-deployment-guide.md
├── docker-compose.yml      # 开发环境
├── docker-compose.prod.yml # 生产环境
├── docker-compose.prebuilt.yml # 预构建镜像部署
└── DEPLOYMENT.md           # 生产部署指南
```

### 📋 常用命令

```bash
# 开发
pnpm run dev                    # 启动开发服务器 (Turbopack)
pnpm run dev:up                 # 启动 PostgreSQL + Redis
pnpm run dev:init               # 初始化数据库（建表 + 种子数据）
pnpm run dev:down               # 停止数据库服务

# 数据库
pnpm run db:generate            # 生成 Prisma Client
pnpm run db:push                # 推送 Schema 到数据库
pnpm run db:migrate             # 运行迁移
pnpm run db:studio              # 打开 Prisma Studio

# Worker
pnpm run worker:feed-discovery  # 启动 Feed Discovery Worker
pnpm run worker:preliminary     # 启动预筛选 Worker
pnpm run worker:deep-analysis   # 启动深度分析 Worker

# 测试
pnpm run test                   # 运行测试
pnpm run test:coverage          # 测试覆盖率
```

### 🐳 生产部署

```bash
# 方式 1：一键脚本（推荐）
./start.sh

# 方式 2：预构建镜像
./deploy-prebuilt.sh

# 方式 3：Docker Compose 手动部署
cp .env.example .env
# 编辑 .env 配置安全密钥和域名
docker-compose -f docker-compose.prod.yml up -d
```

> 📖 详细部署指南见 [DEPLOYMENT.md](DEPLOYMENT.md)

**部署架构**（生产环境）：

| 服务 | 说明 |
|------|------|
| app | Next.js 主应用 |
| feed-discovery-worker | Feed 发现 + 首次抓取 |
| preliminary-worker | 文章预筛选（可选） |
| deep-analysis-worker | 深度 AI 分析（可选） |
| postgres | PostgreSQL 16 数据库 |
| redis | Redis 7 缓存 + 消息队列 |

### 🔧 低内存部署

项目内置智能内存管理，`start.sh` 会自动检测系统内存并选择最优配置：

| 系统内存 | 构建内存 | 运行时内存 |
|---------|---------|----------|
| ≥8GB | 3072MB | 768MB |
| 4-8GB | 2048MB | 512MB |
| 2-4GB | 1024MB | 384MB |
| <2GB | 768MB | 256MB |

> 📖 详见 [docs/DOCKER-MEMORY-OPTIMIZATION.md](docs/DOCKER-MEMORY-OPTIMIZATION.md)

### 📝 License

MIT

---

## 🖥️ CLI 终端版

> 单二进制，零依赖，编译即用

### 特性

- 多格式 RSS 支持（RSS 2.0 / Atom / JSON Feed）
- 并发抓取（goroutine + semaphore）
- AI 智能分析（多模型支持）
- 双路径分析引擎 + 预筛选评估
- 加权搜索 + 报告生成（日报/周报）
- OPML 导入导出
- SQLite 存储，纯 Go 实现

### 快速开始

```bash
cd cli
go build -o rss-post-cli .
./rss-post-cli config init
./rss-post-cli feed add https://www.freebuf.com/feed
./rss-post-cli fetch
./rss-post-cli analyze batch --limit 10
./rss-post-cli search "AI安全"
./rss-post-cli report daily
```

### 详细文档

👉 [cli/README.md](cli/README.md)

---

*Built with ❤️ by [BlkSword](https://github.com/BlkSword)*
