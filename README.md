# Rss-Easy

<div align="center">

**智能 RSS 资讯聚合平台**

使用 AI 技术自动摘要、智能分类、全文搜索的下一代 RSS 阅读器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

</div>

---

## 快速开始

### 方式一：一键启动（推荐）

**Windows:**
```bash
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

这将自动：
- 启动 PostgreSQL 数据库
- 启动 Redis 缓存
- 运行数据库迁移
- 填充初始数据
- 启动应用服务

访问 http://localhost:3000

**测试账号:**
- 邮箱: `test@example.com`
- 密码: `password123`

### 方式二：手动启动

1. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置 AI API 密钥
```

2. 配置 AI 服务

**选项 A: 使用官方 API**
```env
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx

# 或 Anthropic Claude
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# 或 DeepSeek
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
```

**选项 B: 使用自定义 API（OpenAI 兼容格式）**

支持国内主流 AI 服务（月之暗面、通义千问、智谱 GLM 等）：

```env
# Moonshot（月之暗面）
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=https://api.moonshot.cn/v1
CUSTOM_API_KEY=sk-xxx
CUSTOM_API_MODEL=moonshot-v1-8k

# 通义千问
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CUSTOM_API_KEY=sk-xxx
CUSTOM_API_MODEL=qwen-plus

# 智谱 GLM
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
CUSTOM_API_KEY=xxx
CUSTOM_API_MODEL=glm-4-plus

# 自建 LocalAI/text-generation-webui
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=http://localhost:5000/v1
CUSTOM_API_KEY=any-string
CUSTOM_API_MODEL=your-model
```

3. 启动 Docker 服务
```bash
docker-compose up -d
```

4. 查看日志
```bash
docker-compose logs -f app
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `docker-compose up -d` | 启动所有服务 |
| `docker-compose down` | 停止所有服务 |
| `docker-compose logs -f app` | 查看应用日志 |
| `docker-compose restart app` | 重启应用 |
| `docker-compose ps` | 查看服务状态 |

## 功能特性

- 🤖 **AI 智能增强** - 自动摘要、智能分类、关键词提取
- 🔍 **强大搜索** - 全文搜索、语义搜索、混合搜索
- 📊 **报告生成** - 日报、周报自动生成
- 📱 **响应式设计** - 支持桌面和移动端
- 🌙 **深色模式** - 护眼的深色主题
- 📥 **OPML 导入导出** - 轻松迁移订阅源

## 技术栈

- **Next.js 15** + **React 19** + **TypeScript**
- **tRPC** + **Prisma** + **PostgreSQL**
- **Tailwind CSS** + **shadcn/ui**
- **OpenAI** / **Claude** / **DeepSeek** / **Ollama**

## 许可证

MIT License
