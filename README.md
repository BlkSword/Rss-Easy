# Rss-Easy

<div align="center">

**智能 RSS 资讯聚合平台**

使用 AI 技术自动摘要、智能分类、全文搜索的下一代 RSS 阅读器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue)](https://www.docker.com/)

</div>

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [Docker 部署](#docker-部署)
- [功能说明](#功能说明)
- [生产环境配置](#生产环境配置)
- [故障排除](#故障排除)
- [常见问题](#常见问题)
- [安全注意事项](#安全注意事项)
- [贡献指南](#贡献指南)

---

## 项目简介

Rss-Easy 是一款现代化的 RSS 聚合阅读器，集成了 AI 技术，提供智能化的资讯阅读体验。采用双层 AI 分析架构，优化成本和质量，为用户提供精准的资讯摘要和智能推荐。

### 核心特性

#### AI 智能增强
- **智能摘要** - 自动提取文章核心内容，支持一句话总结
- **深度分析** - 主要观点、关键引用、多维度评分（深度、质量、实用性、新颖性）
- **情感分析** - 判断文章情感倾向（积极/消极/中性）
- **智能分类** - 自动归类文章主题
- **重要性评分** - 评估文章价值（1-5 分）
- **反思引擎** - 自动检查分析质量，迭代改进结果

#### 搜索功能
- **全文搜索** - 搜索标题和内容
- **语义搜索** - 基于向量相似度的智能搜索
- **搜索建议** - 实时搜索建议
- **热门搜索** - 显示常搜关键词
- **高级过滤** - 按订阅源、分类、状态筛选

#### 自动化
- **订阅规则** - 自动化文章处理，支持条件匹配和批量操作
- **智能报告** - AI 生成的日报、周报，自动总结阅读内容
- **定时抓取** - 自动抓取订阅源新内容

#### 用户体验
- **响应式设计** - 完美支持桌面和移动端
- **深色模式** - 护眼的深色主题
- **多语言支持** - 中英文界面
- **阅读进度** - 自动保存阅读位置和进度
- **OPML 导入导出** - 轻松迁移订阅源

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, Ant Design 6 |
| 组件库 | shadcn/ui, Lucide Icons |
| API | tRPC (类型安全) + REST API |
| 数据库 | PostgreSQL 16 + Prisma ORM 6 + pgvector |
| 缓存/队列 | Redis + BullMQ |
| 认证 | JWT (jose) + HTTP-only Cookies |
| AI 服务 | OpenAI / Anthropic / DeepSeek / Custom API |
| 容器 | Docker + Docker Compose |
| 部署 | Standalone 模式 |

---

## 快速开始

### 方式一：Docker 一键启动（推荐）

#### Windows

```bash
# 启动所有服务（数据库 + Redis + 应用）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### Linux/macOS

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

这将自动：
- 启动 PostgreSQL 数据库
- 启动 Redis 缓存和队列
- 运行数据库迁移
- 填充初始数据
- 启动应用服务

访问 http://localhost:3000，使用您的账号登录或注册新账号。

### 方式二：本地开发

#### 前置要求

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

#### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-username/rss-easy.git
cd rss-easy
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和 AI 服务
```

4. **初始化数据库**
```bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到数据库（开发环境）
npm run db:push

# 填充初始数据
npm run db:seed
```

5. **启动开发服务器**
```bash
# 启动 Next.js 开发服务器（Turbopack）
npm run dev

# 或启动队列处理器（另一个终端）
npm run worker:preliminary
npm run worker:deep-analysis
```

访问 http://localhost:3000

---

## 环境变量配置

### 必需配置

```env
# ==================== 应用配置 ====================
NODE_ENV=production
APP_URL=http://localhost:3000
PORT=3000

# ==================== 数据库配置 ====================
# PostgreSQL 连接字符串
DATABASE_URL="postgresql://rss_easy:your_password@localhost:5432/rss_easy"

# 生产环境建议使用连接池
# DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=10&pool_timeout=20"

# ==================== Redis 配置 ====================
REDIS_URL="redis://:password@localhost:6379"
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# ==================== 认证配置 ====================
# JWT 密钥（生产环境必须更改，至少 32 字符）
JWT_SECRET="your-super-secret-jwt-key-min-32-characters-long"
NEXTAUTH_SECRET="your-super-secret-nextauth-key"
NEXTAUTH_URL=http://localhost:3000

# ==================== AI 服务配置 ====================
# AI 提供商选择（openai | anthropic | deepseek | ollama | custom）
AI_PROVIDER=openai

# OpenAI 配置
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini

# Anthropic 配置
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# DeepSeek 配置（推荐用于中文内容）
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# 自定义 API（支持国内 AI 服务）
CUSTOM_API_BASE_URL=https://api.moonshot.cn/v1
CUSTOM_API_KEY=sk-xxx
CUSTOM_API_MODEL=moonshot-v1-8k

# ==================== AI-Native 配置（可选） ====================
# 初步评估最低价值分数（默认 3）
PRELIMINARY_MIN_VALUE=3

# 是否启用反思引擎（默认 true）
REFLECTION_ENABLED=true

# 最大反思轮数（默认 2）
MAX_REFLECTION_ROUNDS=2

# ==================== 邮件通知（可选） ====================
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=your-api-key
SMTP_FROM=noreply@yourdomain.com

# ==================== 监控和追踪（可选） ====================
# Sentry 错误追踪
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# 日志级别（debug | info | warn | error）
LOG_LEVEL=info

# ==================== Node.js 优化 ====================
NODE_OPTIONS=--max-old-space-size=2048
```

### AI 服务商配置示例

#### Moonshot（月之暗面）

```env
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=https://api.moonshot.cn/v1
CUSTOM_API_KEY=sk-xxx
CUSTOM_API_MODEL=moonshot-v1-8k
```

#### 通义千问

```env
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CUSTOM_API_KEY=sk-xxx
CUSTOM_API_MODEL=qwen-plus
```

#### 智谱 GLM

```env
AI_PROVIDER=custom
CUSTOM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
CUSTOM_API_KEY=xxx
CUSTOM_API_MODEL=glm-4-plus
```

---

## Docker 部署

### Docker Compose 配置

项目包含完整的 Docker Compose 配置，包括：

- **PostgreSQL 数据库** - 持久化存储
- **Redis 缓存** - 队列和缓存
- **应用服务** - Next.js standalone 模式
- **数据库初始化** - 自动运行迁移和种子数据

### 生产环境部署

#### 1. 修改 Docker Compose 配置

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-rss_easy}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # 使用环境变量
      POSTGRES_DB: ${POSTGRES_DB:-rss_easy}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: always

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - AI_PROVIDER=${AI_PROVIDER}
    depends_on:
      - db
      - redis
    restart: always
```

#### 2. 创建生产环境变量文件

```bash
cp .env.example .env.production
# 编辑 .env.production，配置生产环境变量
```

#### 3. 启动服务

```bash
# 使用生产配置启动
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f app

# 停止服务
docker-compose -f docker-compose.prod.yml down
```

#### 4. 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build

# 重启服务
docker-compose up -d
```

### 使用 Nginx 反向代理（推荐）

生产环境建议使用 Nginx 作为反向代理，配置 HTTPS 和负载均衡。

```nginx
# /etc/nginx/conf.d/rss-easy.conf

upstream rss_easy {
    server localhost:3000;
}

# 限流配置
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    server_name your-domain.com;

    # 强制 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 静态文件缓存
    location /_next/static {
        alias /var/www/rss-easy/.next/static;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API 限流
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://rss_easy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://rss_easy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 功能说明

### 1. 订阅源管理

- **添加订阅源** - 支持 RSS/Atom/JSON Feed 格式
- **自动发现** - 从 URL 自动发现订阅源
- **批量操作** - 批量刷新、删除、移动分类
- **错误监控** - 订阅源错误自动检测和通知
- **HTTP 缓存** - 支持 ETag 和 Last-Modified，减少请求

### 2. 文章阅读

- **沉浸式阅读** - 干净的阅读界面
- **富文本渲染** - 支持图片、代码块、表格
- **阅读进度** - 自动保存阅读位置
- **快捷操作** - 键盘快捷键支持
- **原文链接** - 快速跳转到原文

### 3. AI 智能分析

#### 初步评估（快速筛选）

- **主题识别** - 识别文章主题和内容类型
- **价值评分** - 1-5 分评估文章价值
- **语言检测** - 自动检测文章语言
- **过滤决策** - 自动过滤低质量内容

#### 深度分析（完整分析）

- **一句话总结** - 快速了解文章主旨
- **主要观点** - 提取文章核心论点
- **关键引用** - 标记重要引用和金句
- **多维度评分** - 深度、质量、实用性、新颖性评分

#### AI-Native 架构优势

- **成本优化** - 初步评估过滤低质内容，节省深度分析成本
- **质量保证** - 反思引擎自动检查分析质量
- **智能模型选择** - 根据语言自动选择最佳模型
- **用户反馈** - 持续学习和优化

### 4. 搜索功能

- **全文搜索** - 基于 PostgreSQL 全文搜索
- **语义搜索** - 基于向量相似度（pgvector）
- **智能建议** - 实时搜索建议
- **搜索历史** - 保存搜索记录
- **高级过滤** - 多条件组合筛选

### 5. 报告系统

- **自动生成** - 定时生成日报、周报
- **AI 总结** - 精选文章摘要
- **趋势分析** - 阅读偏好和趋势
- **多格式导出** - Markdown/HTML/JSON
- **公开分享** - 生成分享链接

### 6. 订阅规则

自动化处理文章，基于条件匹配执行动作：

**匹配条件:**
- 字段：标题、内容、作者、分类、标签、订阅源
- 操作符：包含、不包含、等于、正则匹配、在列表中

**执行动作:**
- 标记已读/未读
- 加星标/取消星标
- 归档/取消归档
- 分配到分类
- 添加/移除标签

### 7. 通知系统

- 新文章通知
- 报告生成通知
- AI 分析完成通知
- 订阅源错误通知
- 邮件通知（可选配置）

---

## 生产环境配置

### 安全配置

#### 1. 环境变量安全

```bash
# 不要将 .env 文件提交到 Git
echo ".env" >> .gitignore

# 生产环境使用密钥管理服务
# - AWS Secrets Manager
# - Azure Key Vault
# - HashiCorp Vault
```

#### 2. 强密码策略

确保以下密钥强度：
- JWT_SECRET: 至少 32 字符，随机生成
- NEXTAUTH_SECRET: 至少 32 字符，随机生成
- 数据库密码: 至少 16 字符，包含大小写字母、数字、特殊字符
- Redis 密码: 至少 16 字符

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 3. 安全头部配置

在 `next.config.ts` 中配置：

```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.openai.com",
            "frame-ancestors 'none'",
          ].join('; ')
        }
      ]
    }
  ];
}
```

#### 4. HTTPS 配置

生产环境必须使用 HTTPS：

```bash
# 使用 Let's Encrypt 获取免费证书
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 数据库优化

#### 连接池配置

```env
# 在 DATABASE_URL 中添加连接池参数
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=10&pool_timeout=20"
```

#### 定期维护

```sql
-- 定期运行 VACUUM ANALYZE
VACUUM ANALYZE;

-- 检查数据库大小
SELECT pg_size_pretty(pg_database_size('rss_easy'));

-- 查看表大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 性能优化

#### 1. 启用缓存

```typescript
// 安装 Redis 客户端
npm install ioredis

// 配置缓存
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// 设置缓存
await redis.setex('cache:key', 3600, JSON.stringify(data));

// 获取缓存
const cached = await redis.get('cache:key');
```

#### 2. 静态资源 CDN

```typescript
// next.config.ts
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['cdn.your-domain.com'],
  },
};
```

#### 3. 日志级别控制

```env
# 生产环境只记录 info 及以上级别
LOG_LEVEL=info
```

### 监控和告警

#### 健康检查

健康检查端点：`/api/health`

```bash
curl http://localhost:3000/api/health
```

返回示例：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" },
    "ai": { "status": "ok" }
  }
}
```

#### 错误追踪（可选）

集成 Sentry 进行错误追踪：

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

### 备份策略

#### 数据库备份

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="rss_easy"
DB_USER="rss_easy"

mkdir -p $BACKUP_DIR

pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# 保留最近 30 天的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

#### 定时备份（Cron）

```bash
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup.sh
```

---

## 故障排除

### 常见问题

#### 1. 数据库连接失败

**症状:** `Error: Can't reach database server`

**解决方案:**

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 检查连接字符串
echo $DATABASE_URL

# 测试连接
psql $DATABASE_URL
```

#### 2. Redis 连接失败

**症状:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**解决方案:**

```bash
# 检查 Redis 是否运行
sudo systemctl status redis
# 或
docker ps | grep redis

# 测试连接
redis-cli ping
```

#### 3. AI 分析失败

**症状:** 文章抓取成功但没有 AI 分析

**解决方案:**

```bash
# 检查队列状态
npm run queue status

# 启动队列处理器
npm run worker:preliminary
npm run worker:deep-analysis

# 检查 AI 配置
curl http://localhost:3000/api/health
```

#### 4. 内存不足

**症状:** `JavaScript heap out of memory`

**解决方案:**

```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 或在 .env 中设置
echo "NODE_OPTIONS=--max-old-space-size=4096" >> .env
```

#### 5. Docker 构建失败

**症状:** Docker 构建过程中出现错误

**解决方案:**

```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache

# 查看构建日志
docker-compose build --progress=plain
```

### 日志查看

```bash
# Docker 日志
docker-compose logs -f app

# 查看最近 100 行
docker-compose logs --tail=100 app

# 查看特定服务
docker-compose logs -f db
docker-compose logs -f redis
```

---

## 常见问题

### Q: 如何更新应用？

**A:**

```bash
# 拉取最新代码
git pull

# 重新安装依赖
npm install

# 运行数据库迁移
npm run db:push
npm run db:generate

# 重启服务
docker-compose up -d --build
```

### Q: 如何更改 AI 提供商？

**A:** 修改 `.env` 文件中的 `AI_PROVIDER` 和对应的 API Key：

```env
AI_PROVIDER=deepseek  # 更改为其他提供商
DEEPSEEK_API_KEY=sk-xxx
```

重启应用即可。

### Q: AI 分析成本如何控制？

**A:** 项目采用双层分析架构优化成本：

1. **初步评估** - 快速过滤低质内容
2. **深度分析** - 只对高价值文章进行
3. **智能模型选择** - 根据语言选择性价比最高的模型

可以通过调整 `PRELIMINARY_MIN_VALUE` 控制深度分析的触发条件。

### Q: 如何备份数据？

**A:** 参见上文 [备份策略](#备份策略) 章节。

### Q: 支持多少订阅源？

**A:** 理论上无限制，实际取决于：

- 服务器性能
- 网络带宽
- AI 处理能力

建议单个用户不超过 500 个订阅源。

### Q: 如何启用多用户？

**A:** 项目默认支持多用户，每个用户的数据完全隔离。只需要：

1. 注册新用户账号
2. 每个用户独立管理自己的订阅源和文章

---

## 安全注意事项

### 部署前检查清单

- [ ] 修改所有默认密码（JWT_SECRET、数据库密码、Redis 密码）
- [ ] 配置 HTTPS 证书
- [ ] 启用安全头部（CSP、HSTS、X-Frame-Options）
- [ ] 配置 CORS 和 CSRF 保护
- [ ] 设置速率限制
- [ ] 启用日志监控
- [ ] 配置定期备份
- [ ] 测试健康检查端点

### 生产环境建议

1. **使用 HTTPS** - 必须启用，保护数据传输安全
2. **强密码策略** - 所有密钥使用随机生成的强密码
3. **定期更新** - 及时更新依赖和安全补丁
4. **监控告警** - 配置监控和告警系统
5. **备份恢复** - 定期备份并测试恢复流程
6. **最小权限** - 数据库用户只授予必要权限

### 已知安全限制

- **速率限制** - 当前版本需要手动配置
- **CSRF 保护** - 需要在生产环境启用
- **API 密钥存储** - 用户自定义 AI 密钥建议加密存储

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
npm run test:coverage    # 生成测试覆盖率报告

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 schema 变更到数据库（开发环境）
npm run db:migrate       # 运行数据库迁移（生产环境）
npm run db:studio        # 打开 Prisma Studio
npm run db:seed          # 填充初始数据

# AI-Native 智能分析脚本
npm run test:preliminary      # 测试初步评估
npm run test:deep-analysis    # 测试深度分析
npm run test:smart-analyzer   # 测试智能分析器
npm run cost-analysis         # 成本分析报告
npm run worker:preliminary    # 启动初步评估 Worker
npm run worker:deep-analysis  # 启动深度分析 Worker
npm run queue                 # 队列管理工具
```

---

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 编写单元测试
- 更新相关文档

### Commit 规范

遵循 Conventional Commits 规范：

- `feat:` - 新功能
- `fix:` - Bug 修复
- `refactor:` - 重构
- `docs:` - 文档更新
- `test:` - 测试相关
- `chore:` - 构建/工具相关

---

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 联系方式

- 项目主页: [GitHub](https://github.com/your-username/rss-easy)
- 问题反馈: [Issues](https://github.com/your-username/rss-easy/issues)
- 讨论区: [Discussions](https://github.com/your-username/rss-easy/discussions)

---

## 鸣谢

- [Next.js](https://nextjs.org/) - React 框架
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [tRPC](https://trpc.io/) - 端到端类型安全 API
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [OpenAI](https://openai.com/) - AI 服务支持
- [Anthropic](https://www.anthropic.com/) - Claude AI 支持

---

**如果这个项目对你有帮助，请给个 Star ⭐**
