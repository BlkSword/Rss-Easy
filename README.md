<div align="center">

<img src="public/logo.png" alt="RSS-Post" width="64" height="64">

# RSS-Post

**AI 驱动的智能 RSS 信息聚合平台**

将碎片化的信息流转化为结构化的知识资产 -- 双层 AI 引擎自动筛选、分析、评分，帮你从海量信息中高效捕获真正有价值的内容。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8)](https://go.dev/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED)](https://www.docker.com/)

</div>

---

## 目录

- [项目简介](#项目简介)
- [功能预览](#功能预览)
- [核心特性](#核心特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
  - [Web 平台](#web-平台)
  - [CLI 工具](#cli-工具)
- [配置说明](#配置说明)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [部署](#部署)
- [贡献指南](#贡献指南)
- [License](#license)

---

## 项目简介

RSS-Post 包含两个产品形态，满足不同使用场景：

| | Web 平台 | CLI 工具 |
|---|---|---|
| **定位** | 全功能信息聚合平台 | 精简终端工具 |
| **技术** | Next.js 16 + React 19 + PostgreSQL | Go 单二进制 |
| **适合** | 可视化浏览、团队协作 | 服务器部署、自动化、重度终端用户 |
| **依赖** | Docker (PostgreSQL + Redis) | 零依赖 |
| **入口** | [`/`](#web-平台) | [`/cli`](#cli-工具) |

---

## 功能预览

### Web 平台

沉浸式阅读体验，AI 分析结果一目了然。支持深色模式、移动端适配、PWA 离线访问。

<div align="center">
  <img src="public/icons/icon-512x512.png" alt="RSS-Post" width="120">
</div>

### CLI 工具

终端原生体验，编译即用，适合服务器自动化部署。

```bash
$ rss-post-cli feed add https://www.freebuf.com/feed
✓ Feed added: FreeBuf (ID: 1)

$ rss-post-cli fetch
Fetching 12 feeds (concurrency: 10)...
✓ Fetched 47 new entries in 3.2s

$ rss-post-cli analyze batch --limit 10
Analyzing 10 entries (concurrency: 3)...
✓ Analyzed 10/10 entries, avg score: 7.3

$ rss-post-cli report daily
# Daily Report - 2026-04-03

**Period:** 2026-04-03 to 2026-04-04

## Statistics
- Total Articles: 169
- Analyzed: 169
- Average AI Score: 6.8

## Top Picks (Score 8+)
### [Breaking: Critical RCE in OpenSSH] →
> 新发现的 OpenSSH 远程代码执行漏洞影响范围广泛...
**Score:** 9/10
```

---

## 核心特性

### AI 双层分析引擎

```
文章内容
    │
    ├─ 预筛选 (低成本模型, ~1s)
    │   ├─ 评分 < 2 → 跳过（低价值，节省 API 费用）
    │   └─ 评分 >= 2 → 进入深度分析
    │
    ├─ 内容长度判断
    │   ├─ <= 6000 字符 → 直接分析
    │   ├- <= 12000 字符 → 分段分析 + 合并
    │   └─ > 12000 字符 → 截取前 6000 字符
    │
    └─ 深度分析 → 摘要 / 要点 / 标签 / 四维评分 / 开源信息提取
```

- **多模型支持** -- OpenAI / Anthropic / DeepSeek / Gemini / 智谱 GLM / Ollama / 自定义 API
- **语言分支** -- 根据文章语言自动选择最优模型组合
- **反思引擎**（Web）-- 对分析结果二次校验，提升准确度
- **四维评分** -- 深度 / 质量 / 实用性 / 新颖性，综合评分 1-10

### RSS 引擎

- 多格式支持：RSS 2.0 / Atom / JSON Feed
- OPML 批量导入导出
- 自动发现和补全订阅源信息
- 并发抓取 + 定时调度
- 站点特定内容提取（CSS 选择器适配）

### 智能搜索

- 关键词搜索 + AI 标签语义搜索
- 加权排序：标题(10) > 标签(8) > 摘要(5) > 内容(3)
- 搜索历史记录
- 高级过滤：按订阅源、分类、状态、AI 评分

### 智能报告

- 自动生成日报 / 周报
- AI 生成趋势总结
- HTML 格式邮件推送
- 定时自动发送（systemd / crontab）

### 自动化规则

- 基于关键词、标签、AI 评分等条件匹配
- 自动标记已读、收藏、归档、打标签
- 规则执行历史追踪

---

## 架构设计

### Web 平台

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

### CLI 工具

```
cmd/                    # CLI 命令层 (cobra)
internal/               # 核心业务逻辑
  ├── db/               # SQLite 数据库层 (纯 Go, 零依赖)
  ├── rss/              # RSS 解析引擎 (gofeed)
  ├── ai/               # AI 分析引擎 (多提供商)
  ├── search/           # 加权搜索引擎
  ├── report/           # 报告生成 + HTML 渲染
  ├── email/            # SMTP 邮件发送
  └── output/           # 终端格式化输出
```

---

## 快速开始

### Web 平台

#### Docker 一键部署（推荐）

```bash
git clone https://github.com/BlkSword/RSS-Post.git
cd RSS-Post

cp .env.example .env
./start.sh
```

启动后访问 `http://localhost:8915`，默认账号：`test@example.com` / `password123`

#### 预构建镜像（快速部署）

```bash
./deploy-prebuilt.sh
```

#### 本地开发

```bash
pnpm install
pnpm run dev:up          # 启动 PostgreSQL + Redis
pnpm run dev:init        # 初始化数据库
pnpm run dev             # 启动开发服务器
pnpm run worker:feed-discovery   # 启动 Worker
```

### CLI 工具

#### 从源码编译

```bash
cd cli
go build -o rss-post-cli .
sudo mv rss-post-cli /usr/local/bin/
```

#### 交叉编译

```bash
# Linux ARM64 (树莓派)
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o rss-post-cli-arm64 .

# Linux AMD64
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o rss-post-cli-amd64 .

# macOS ARM64 (Apple Silicon)
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o rss-post-cli-darwin-arm64 .

# Windows
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o rss-post-cli.exe .
```

#### 快速上手

```bash
# 1. 初始化配置
rss-post-cli config init

# 2. 添加订阅源
rss-post-cli feed add https://www.freebuf.com/feed
rss-post-cli feed add https://blog.cloudflare.com/rss/

# 3. 抓取文章
rss-post-cli fetch

# 4. AI 分析
rss-post-cli analyze batch --limit 10

# 5. 搜索
rss-post-cli search "AI安全"

# 6. 生成日报
rss-post-cli report daily

# 7. 发送邮件
rss-post-cli report send
```

---

## 配置说明

### Web 平台

核心配置在 `.env` 文件中（参考 [.env.example](.env.example)）：

```env
# 必需
APP_URL=http://localhost:8915
JWT_SECRET="你的随机密钥-至少32字符"
NEXTAUTH_SECRET="你的随机密钥-至少32字符"
ENCRYPTION_KEY="你的随机密钥-32字符"

# AI 配置（也可在设置界面配置）
AI_PROVIDER="openai"                    # openai | anthropic | deepseek | ollama | custom
OPENAI_API_KEY="sk-xxx"                 # 或对应提供商的 Key

# 自定义 AI（如智谱 GLM）
AI_PROVIDER="custom"
CUSTOM_API_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
CUSTOM_API_KEY="your-key"
CUSTOM_API_MODEL="glm-4"

# 邮件推送（可选）
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_USER="your@qq.com"
SMTP_PASSWORD="your-smtp-auth-code"
```

### CLI 工具

配置文件：`~/.rss-post/config.toml`

```toml
[ai]
provider = "openai"
model = "glm-5-turbo"
api_key = "your-api-key"
base_url = "https://open.bigmodel.cn/api/paas/v4"

  [ai.preliminary]
  enabled = true
  model = "glm-4-flash"

[email]
enabled = true
from = "your@email.com"
to = ["recipient@email.com"]

  [email.smtp]
  host = "smtp.qq.com"
  port = 465
  username = "your@email.com"
  password = "your-smtp-password"

[proxy]
enabled = false
type = "http"
host = "127.0.0.1"
port = "7890"
```

常用 SMTP 配置：

| 邮箱 | Host | Port |
|------|------|------|
| QQ 邮箱 | smtp.qq.com | 465 |
| 163 邮箱 | smtp.163.com | 465 |
| Gmail | smtp.gmail.com | 465 |
| Outlook | smtp.office365.com | 587 |

---

## 项目结构

```
├── app/                        # Next.js App Router 页面
│   ├── auth/                   # 登录/注册
│   ├── entries/                # 文章列表/详情
│   ├── feeds/                  # 订阅源管理
│   ├── categories/             # 分类管理
│   ├── search/                 # 搜索
│   ├── reports/                # 报告
│   ├── rules/                  # 自动化规则
│   └── settings/               # 设置
├── cli/                        # Go CLI 工具
│   ├── cmd/                    # CLI 命令 (cobra)
│   └── internal/               # 核心逻辑
├── components/                 # React 组件
├── lib/                        # 业务逻辑
│   ├── ai/                     # AI 分析引擎
│   ├── rss/                    # RSS 解析
│   ├── queue/                  # BullMQ 队列
│   ├── reports/                # 报告生成
│   └── trpc/                   # tRPC Router
├── prisma/                     # 数据库 Schema
├── public/                     # 静态资源 (logo, favicon)
├── docker-compose.yml
├── docker-compose.prod.yml
└── docs/                       # 额外文档
```

---

## 技术栈

### Web 平台

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4 + Ant Design 6 + shadcn/ui + Framer Motion |
| API | tRPC + REST |
| 数据库 | PostgreSQL 16 + Prisma 6 + pgvector |
| 队列 | Redis 7 + BullMQ 5 |
| 认证 | JWT (jose) + HTTP-only Cookies |
| 部署 | Docker + Docker Compose |

### CLI 工具

| 组件 | 技术 |
|------|------|
| 语言 | Go 1.24+ |
| CLI 框架 | [cobra](https://github.com/spf13/cobra) |
| 数据库 | [modernc.org/sqlite](https://gitlab.com/cznic/sqlite) (纯 Go, 无 CGO) |
| RSS 解析 | [mmcdole/gofeed](https://github.com/mmcdole/gofeed) |
| 终端表格 | [olekukonko/tablewriter](https://github.com/olekukonko/tablewriter) |

---

## 部署

### Web 平台

| 系统内存 | 构建内存 | 运行时内存 |
|---------|---------|----------|
| >=8GB | 3072MB | 768MB |
| 4-8GB | 2048MB | 512MB |
| 2-4GB | 1024MB | 384MB |
| <2GB | 768MB | 256MB |

`start.sh` 会自动检测内存并选择最优配置。

> 详细部署指南见 [DEPLOYMENT.md](DEPLOYMENT.md)

### CLI 工具

```bash
# systemd 一键安装
rss-post-cli install

# 或手动配置
rss-post-cli daemon    # 后台服务（抓取 + 分析 + 规则 + 报告一体化）

# 定时报告（systemd timer）
rss-post-cli report install
```

---

## 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## License

[MIT](LICENSE)

---

<div align="center">

**Built by [BlkSword](https://github.com/BlkSword)**

</div>
