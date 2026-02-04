# Rss-Easy

<div align="center">

**智能 RSS 资讯聚合平台**

使用 AI 技术自动摘要、智能分类、全文搜索的下一代 RSS 阅读器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

</div>

---

## 项目简介

Rss-Easy 是一款现代化的 RSS 聚合阅读器，集成了 AI 技术，提供智能化的资讯阅读体验。

### 核心特性

- 🤖 **AI 智能增强** - 自动摘要、智能分类、情感分析、重要性评分
- 🔍 **强大搜索** - 全文搜索、语义搜索、搜索建议、热门搜索
- 📊 **智能报告** - AI 生成的日报、周报，自动总结阅读内容
- 📋 **订阅规则** - 自动化文章处理，支持条件匹配和批量操作
- 🔔 **通知系统** - 实时通知新文章、报告生成、AI 分析完成
- 📁 **分类管理** - 层级分类、标签管理、批量操作
- ⭐ **星标收藏** - 重要文章快速收藏和回顾
- 📱 **响应式设计** - 完美支持桌面和移动端
- 🌙 **深色模式** - 护眼的深色主题
- 📥 **OPML 导入导出** - 轻松迁移订阅源

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
- 运行数据库迁移
- 填充初始数据
- 启动应用服务

访问 http://localhost:3000

**测试账号:**
- 邮箱: `test@example.com`
- 密码: `password123`

### 方式二：手动启动

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件
```

3. 初始化数据库
```bash
npx prisma migrate deploy
npx prisma db seed
```

4. 启动开发服务器
```bash
npm run dev
```

### 环境变量配置

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/rss_easy"

# JWT 密钥
JWT_SECRET="your-secret-key-here"

# AI 服务配置（可选）
AI_PROVIDER="openai"  # openai | anthropic | deepseek | custom
OPENAI_API_KEY="sk-xxx"
ANTHROPIC_API_KEY="sk-ant-xxx"
DEEPSEEK_API_KEY="sk-xxx"

# 自定义 API（支持国内 AI 服务）
CUSTOM_API_BASE_URL="https://api.moonshot.cn/v1"
CUSTOM_API_KEY="sk-xxx"
CUSTOM_API_MODEL="moonshot-v1-8k"
```



## 功能说明

### 1. 订阅源管理

- 添加/删除/编辑 RSS 订阅源
- 自动抓取新内容（支持 HTTP 缓存）
- 订阅源分类管理
- 批量操作（刷新、删除、移动分类）
- 订阅源错误监控和通知

### 2. 文章阅读

- 沉浸式阅读界面
- 原文链接跳转
- 阅读进度保存
- 标记已读/未读
- 星标收藏
- 归档管理

### 3. AI 智能增强

AI 自动为每篇文章提供：
- **智能摘要** - 提取文章核心内容
- **关键词** - 自动提取关键词
- **情感分析** - 判断文章情感倾向
- **智能分类** - 自动归类文章主题
- **重要性评分** - 评估文章价值

### 4. 搜索功能

- **全文搜索** - 搜索标题和内容
- **搜索建议** - 实时搜索建议
- **热门搜索** - 显示常搜关键词
- **搜索历史** - 保存搜索记录
- **高级过滤** - 按订阅源、分类、状态筛选

### 5. 报告系统

- **日报/周报** - AI 自动生成阅读报告
- **内容总结** - 精选文章摘要
- **趋势分析** - 热门主题统计
- **报告导出** - Markdown/HTML/JSON 格式
- **报告分享** - 生成公开分享链接

### 6. 订阅规则

自动化处理文章，支持：

**匹配条件:**
- 字段：标题、内容、作者、分类、标签、订阅源
- 操作符：包含、不包含、等于、不等于、正则匹配、在列表中

**执行动作:**
- 标记已读/未读
- 加星标/取消星标
- 归档/取消归档
- 分配到分类
- 添加/移除标签
- 跳过处理

### 7. 通知系统

- 新文章通知
- 报告生成通知
- AI 分析完成通知
- 订阅源错误通知
- 未读数量实时显示



## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| 组件 | shadcn/ui, Lucide Icons |
| API | tRPC |
| 数据库 | PostgreSQL + Prisma ORM |
| 认证 | JWT (jose) |
| AI | OpenAI / Anthropic / DeepSeek / Custom |
| 容器 | Docker + Docker Compose |


