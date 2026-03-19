# RSS-Post

> 🤖 AI 驱动的智能 RSS 信息聚合平台

RSS-Post 是一个智能信息聚合工具，旨在将碎片化的信息流转化为结构化的知识资产。项目包含两个部分：

- **Web 平台** (`/`) — 基于 Next.js 16 + React 19 的全栈 Web 应用（原版）
- **CLI 工具** (`/cli`) — 基于 Go 的终端版本，精简高效，单二进制运行

---

## 🖥️ CLI 终端版（推荐）

> 单二进制，零依赖，编译即用

### 特性

- **多格式支持** — RSS 2.0、Atom、JSON Feed
- **并发抓取** — goroutine + semaphore，高效抓取大量订阅源
- **AI 智能分析** — 多模型支持（OpenAI / Anthropic / DeepSeek / 智谱 / 自定义）
- **双路径分析引擎** — 短文直分析 + 长文分段分析
- **预筛选评估** — 小模型快速过滤低价值文章，节省 API 费用
- **加权搜索** — 关键词搜索，按标题/摘要/内容/AI 标签加权排序
- **报告生成** — 日报/周报，Markdown 格式，支持 AI 总结
- **OPML 导入导出** — 批量管理订阅源
- **SQLite 存储** — 纯 Go 实现，零 CGO 依赖
- **单二进制** — 静态编译，跨平台

### 快速开始

```bash
cd cli

# 安装依赖
go mod tidy

# 编译
go build -o rss-post-cli .

# 初始化配置
./rss-post-cli config init

# 编辑配置（设置 API Key）
vi ~/.rss-post/config.toml

# 添加订阅源
./rss-post-cli feed add https://www.freebuf.com/feed
./rss-post-cli feed add https://blog.cloudflare.com/rss/

# 抓取
./rss-post-cli fetch

# AI 分析
./rss-post-cli analyze batch --limit 10

# 搜索
./rss-post-cli search "AI安全"

# 生成日报
./rss-post-cli report daily
```

### 详细文档

👉 [cli/README.md](cli/README.md)

---

## 🌐 Web 平台版（原版）

基于 Next.js 16 + React 19 + PostgreSQL + pgvector 的全栈 Web 应用。

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4 + Ant Design 6 + shadcn/ui + Framer Motion |
| API | tRPC + REST |
| 数据库 | PostgreSQL 16 + Prisma 6 + pgvector |
| 队列 | Redis + BullMQ 5 |
| 认证 | JWT (jose) + HTTP-only Cookies |
| 部署 | Docker + Docker Compose |

### 启动

```bash
# 使用 Docker
docker-compose up -d

# 或本地开发
cp .env.example .env
pnpm install
pnpm run dev
```

---

## License

MIT
