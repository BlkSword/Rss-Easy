# RSS-Post CLI

> 🤖 智能终端版，为深度阅读者打造的 AI 驱动 RSS 信息聚合工具

RSS-Post CLI 是原 [RSS-Post](https://github.com/BlkSword/RSS-Post) 全栈平台的精简终端版。去掉了前端和 Web 服务，保留了核心的 RSS 抓取、AI 智能分析和信息聚合能力，编译为单个二进制文件，开箱即用。

## ✨ 特性

- **多格式支持** — RSS 2.0、Atom、JSON Feed
- **并发抓取** — goroutine + semaphore 控制并发，高效抓取大量订阅源
- **AI 智能分析** — 多模型支持（OpenAI / Anthropic / DeepSeek / 智谱 / 自定义），自动摘要、分类、评分
- **双路径分析引擎** — 短文直分析 + 长文分段分析，根据内容长度自动选择最优策略
- **预筛选评估** — 用小模型快速过滤低价值文章，节省 API 费用
- **加权搜索** — 关键词搜索，按标题/摘要/内容/AI 标签加权排序
- **报告生成** — 日报/周报，Markdown 格式，支持 AI 生成总结
- **OPML 导入导出** — 批量管理订阅源
- **SQLite 存储** — 纯 Go 实现，零依赖，单文件数据库
- **代理支持** — HTTP/SOCKS5 代理配置
- **单二进制** — 静态编译，无运行时依赖

## 📦 安装

### 从源码编译

```bash
# 克隆
git clone https://github.com/BlkSword/rss-post-cli.git
cd rss-post-cli

# 安装依赖
go mod tidy

# 编译
go build -o rss-post-cli .

# 安装到 PATH
sudo mv rss-post-cli /usr/local/bin/
```

### 交叉编译

```bash
# Linux ARM64 (树莓派等)
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o rss-post-cli-arm64 .

# Linux AMD64
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o rss-post-cli-amd64 .

# macOS AMD64
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -o rss-post-cli-darwin .

# macOS ARM64 (Apple Silicon)
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o rss-post-cli-darwin-arm64 .

# Windows
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o rss-post-cli.exe .
```

## 🚀 快速开始

### 1. 初始化配置

```bash
rss-post config init
```

配置文件默认创建在 `~/.rss-post/config.toml`：

```toml
[database]
path = "~/.rss-post/data.db"

[ai]
provider = "openai"          # openai, anthropic, deepseek, custom
model = "glm-4.7"            # 主分析模型
api_key = ""                 # 你的 API Key
base_url = ""                # 自定义 API 地址（如使用智谱：https://open.bigmodel.cn/api/paas/v4）
max_tokens = 4096
temperature = 0.7

  [ai.preliminary]
  enabled = true             # 启用预筛选（省钱）
  model = "glm-4-flash"      # 预筛选用的小模型

[fetch]
concurrency = 10             # 并发抓取数
timeout = "1m0s"             # 抓取超时
user_agent = "Mozilla/5.0 (compatible; RSS-Post/1.0)"

[proxy]
enabled = false              # 是否启用代理
type = "http"                # http, socks5
host = "127.0.0.1"
port = "7890"

[output]
format = "table"             # table, markdown
color = true                 # 终端彩色输出
```

### 2. 添加订阅源

```bash
# 添加单个订阅源
rss-post feed add https://www.freebuf.com/feed
rss-post feed add https://blog.cloudflare.com/rss/
rss-post feed add https://github.blog/feed/

# 从 OPML 文件批量导入
rss-post feed import feeds.opml
```

### 3. 抓取文章

```bash
# 抓取所有订阅源
rss-post fetch

# 抓取指定订阅源
rss-post fetch 1

# 后台定时抓取（每 30 分钟）
rss-post fetch daemon --interval 30
```

### 4. 浏览文章

```bash
# 列出最新文章（默认 50 条）
rss-post entries list

# 按条件过滤
rss-post entries list --limit 20          # 只看 20 条
rss-post entries list --feed 1            # 指定订阅源
rss-post entries list --unread            # 未读
rss-post entries list --starred           # 收藏
rss-post entries list --min-score 7       # AI 评分 ≥ 7

# 查看文章详情
rss-post entries show 1

# 标记已读 / 收藏
rss-post entries read 1
rss-post entries star 1
rss-post entries unstar 1
rss-post entries unread 1
```

### 5. AI 分析

```bash
# 分析单篇文章
rss-post analyze entry 1

# 强制重新分析
rss-post analyze entry 1 --force

# 批量分析待处理文章
rss-post analyze batch --limit 10 --concurrency 3

# 查看分析统计
rss-post analyze stats
```

AI 分析结果包含：

| 字段 | 说明 |
|------|------|
| One-line Summary | 一句话总结 |
| Summary | 详细摘要（2-3 段） |
| Main Points | 要点列表（含解释和重要性） |
| Tags | 自动标签 |
| AI Score | 综合评分（1-10） |
| Score Dimensions | 四维评分：深度/质量/实用性/新颖性 |
| Open Source Info | 开源项目信息（仓库/许可证/Stars/语言） |

### 6. 搜索

```bash
# 关键词搜索
rss-post search "AI安全"

# 限制结果数
rss-post search "漏洞" --limit 10
```

搜索按以下权重排序：标题(10) > AI 标签(8) > 摘要(5) > 内容(3)，并叠加 AI 评分加权。

### 7. 生成报告

```bash
# 生成今日日报
rss-post report daily

# 生成指定日期的报告
rss-post report daily 2026-03-19

# 生成周报
rss-post report weekly

# 保存到文件
rss-post report daily --output report.md

# 附带 AI 总结
rss-post report daily --ai

# 生成并通过邮件发送
rss-post report daily --email

# 直接发送日报邮件
rss-post report send

# 测试邮件配置
rss-post report test-email --to your@email.com
```

### 8. 邮件推送

支持通过 SMTP 发送 HTML 格式的报告邮件。

配置 `~/.rss-post/config.toml`：

```toml
[email]
enabled = true
from = "your@email.com"
to = ["recipient1@email.com", "recipient2@email.com"]
subject = "RSS-Post 日报"

  [email.smtp]
  host = "smtp.qq.com"           # SMTP 服务器
  port = 465                       # SSL 端口
  username = "your@email.com"      # SMTP 用户名
  password = "your-smtp-password"  # SMTP 密码/授权码
  insecure_skip_verify = false
```

常用 SMTP 配置：

| 邮箱 | Host | Port |
|------|------|------|
| QQ 邮箱 | smtp.qq.com | 465 |
| 163 邮箱 | smtp.163.com | 465 |
| Gmail | smtp.gmail.com | 465 |
| Outlook | smtp.office365.com | 587 |

### 9. 定时报告

支持每天/每周自动生成报告并通过邮件发送。

配置 `~/.rss-post/config.toml`：

```toml
[schedule]
enabled = true          # 启用定时任务
type = "daily"          # "daily" 或 "weekly"
hour = 8                # 每天几点生成（24h）
minute = 0              # 几分
send_mail = true        # 是否同时发送邮件
```

```bash
# 查看定时任务配置
rss-post schedule show

# 启动定时任务守护进程
rss-post schedule run
```

> 💡 配合 systemd 或 crontab 可以实现开机自启和后台运行。

systemd 示例（`/etc/systemd/system/rss-post-schedule.service`）：

```ini
[Unit]
Description=RSS-Post Schedule Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/rss-post-cli schedule run
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable rss-post-schedule
sudo systemctl start rss-post-schedule
```

### 10. 导出订阅源

```bash
rss-post feed export                    # 导出为 feeds.opml
rss-post feed export my-feeds.opml      # 自定义文件名
```

## 📋 命令参考

```
rss-post [command]

Available Commands:
  feed        管理 RSS 订阅源
  fetch       抓取 RSS 订阅源
  entries     管理文章
  analyze     AI 智能分析
  search      搜索文章
  report      生成报告
  schedule    定时报告任务
  config      管理配置

Flags:
      --config string   指定配置文件路径 (默认 ~/.rss-post/config.toml)
  -h, --help            帮助
```

### feed 子命令

```
rss-post feed add <url>              添加订阅源
rss-post feed remove <id>            删除订阅源
rss-post feed list [--active-only]   列出所有订阅源
rss-post feed import <opml-file>     从 OPML 导入
rss-post feed export [output-file]   导出为 OPML
```

### entries 子命令

```
rss-post entries list [--feed N] [--starred] [--unread] [--min-score N] [--limit N]
rss-post entries show <id>
rss-post entries read <id>
rss-post entries unread <id>
rss-post entries star <id>
rss-post entries unstar <id>
rss-post entries open <id>            输出文章 URL
```

### analyze 子命令

```
rss-post analyze entry <id> [--force]
rss-post analyze batch [--limit N] [--concurrency N]
rss-post analyze stats
```

### report 子命令

```
rss-post report daily [YYYY-MM-DD] [--output file] [--ai] [--email] [--to email1 --to email2]
rss-post report weekly [YYYY-MM-DD] [--output file] [--ai] [--email]
rss-post report send                                  生成日报并发送邮件
rss-post report test-email [--to email]               发送测试邮件
```

### schedule 子命令

```
rss-post schedule show                               查看定时任务配置
rss-post schedule run                                启动定时守护进程
```

### config 子命令

```
rss-post config init                           初始化配置文件
rss-post config show                           显示当前配置
rss-post config path                           显示配置文件路径
rss-post config set <key> <value>              设置配置项
```

可用的 config set 键值：

```
ai.provider        AI 提供商 (openai, anthropic, deepseek, custom)
ai.model           主分析模型
ai.base_url        API 地址
ai.api_key         API Key
ai.max_tokens      最大 token 数
ai.temperature     温度
fetch.concurrency  抓取并发数
fetch.timeout      抓取超时（秒）
output.format      输出格式 (table, markdown)
output.color       彩色输出 (true, false)
```

## 🧠 AI 配置示例

### 智谱 GLM

```bash
rss-post config set ai.provider openai
rss-post config set ai.model glm-4.7
rss-post config set ai.base_url https://open.bigmodel.cn/api/paas/v4
rss-post config set ai.api_key YOUR_API_KEY
rss-post config set ai.preliminary.model glm-4-flash
```

### OpenAI

```bash
rss-post config set ai.provider openai
rss-post config set ai.model gpt-4o
rss-post config set ai.base_url https://api.openai.com/v1
rss-post config set ai.api_key YOUR_API_KEY
rss-post config set ai.preliminary.model gpt-4o-mini
```

### Anthropic Claude

```bash
rss-post config set ai.provider anthropic
rss-post config set ai.model claude-sonnet-4-20250514
rss-post config set ai.api_key YOUR_API_KEY
rss-post config set ai.preliminary.model claude-3-haiku-20240307
```

### DeepSeek

```bash
rss-post config set ai.provider openai
rss-post config set ai.model deepseek-chat
rss-post config set ai.base_url https://api.deepseek.com/v1
rss-post config set ai.api_key YOUR_API_KEY
rss-post config set ai.preliminary.model deepseek-chat
```

## 🏗️ 架构

```
cmd/                    # CLI 命令层 (cobra)
  root.go               根命令 + 配置加载
  feed.go               订阅源管理
  fetch.go              抓取调度
  entries.go            文章管理
  analyze.go            AI 分析
  search.go             搜索
  report.go             报告生成 + 邮件发送
  schedule.go           定时报告任务
  config.go             配置管理

internal/               # 核心业务逻辑
  config/config.go      TOML 配置管理
  db/                   SQLite 数据库层
    db.go               初始化 + 建表
    models.go           数据模型
    feeds.go            Feed CRUD
    entries.go          Entry CRUD + 搜索
  rss/                  RSS 引擎
    parser.go           RSS/Atom/JSON Feed 解析 (gofeed)
    fetcher.go          并发抓取器 (goroutine + semaphore)
    opml.go             OPML 导入导出
  ai/                   AI 分析引擎
    client.go           多提供商 HTTP 客户端
    analyzer.go         智能分析器 (双路径)
    prompts.go          Prompt 模板
  search/search.go      加权搜索引擎
  report/report.go      报告生成器 + HTML 渲染
  email/email.go        SMTP 邮件发送
  output/               输出格式化
    table.go            终端表格 (tablewriter)
    markdown.go         Markdown 格式
```

### AI 分析流程

```
文章内容
    │
    ├─ 预筛选评估 (glm-4-flash, ~1s)
    │   ├─ 评分 < 2 → 跳过（低价值）
    │   └─ 评分 ≥ 2 → 继续
    │
    ├─ 内容长度判断
    │   ├─ ≤ 6000 字符 → 直接分析
    │   ├─ ≤ 12000 字符 → 分段分析 + 合并
    │   └─ > 12000 字符 → 截取前 6000 字符分析
    │
    └─ 结果写入数据库
        (摘要/要点/标签/评分/开源信息)
```

## 🔧 开发

### 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Go 1.24+ |
| CLI 框架 | [cobra](https://github.com/spf13/cobra) |
| 数据库 | [modernc.org/sqlite](https://gitlab.com/cznic/sqlite) (纯 Go, 无 CGO) |
| 配置 | [BurntSushi/toml](https://github.com/BurntSushi/toml) |
| RSS 解析 | [mmcdole/gofeed](https://github.com/mmcdole/gofeed) |
| 终端表格 | [olekukonko/tablewriter](https://github.com/olekukonko/tablewriter) |

### 开发

```bash
# 安装依赖
go mod tidy

# 编译
go build -o rss-post-cli .

# 运行
go run .
```

## 📄 License

MIT
