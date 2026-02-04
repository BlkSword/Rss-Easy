# Rss-Easy 项目规划

## 项目概述

Rss-Easy 是一个功能强大的智能RSS资讯聚合平台，支持AI智能摘要、智能分类、全文搜索、日报/周报生成等前沿功能。

## 核心功能

### 1. RSS源管理
- 支持OPML文件导入/导出
- 自动发现和解析RSS源
- 智能更新调度（基于发布频率）
- 错误重试和健康监控
- 分类和标签管理

### 2. AI智能增强
- **智能摘要**: 使用LLM自动生成文章摘要
- **智能分类**: 自动将文章分类到合适的技术栈/主题
- **关键词提取**: 提取文章核心关键词
- **情感分析**: 分析文章情感倾向
- **重要性评分**: 评估文章重要性

### 3. 搜索功能
- **全文搜索**: 基于PostgreSQL的全文搜索
- **语义搜索**: 基于向量嵌入的语义搜索
- **混合搜索**: 结合全文和语义搜索
- **搜索建议**: 智能查询建议
- **搜索历史**: 保存和重用搜索

### 4. 报告生成
- **日报生成**: 每日重要资讯汇总
- **周报生成**: 每周趋势和热点分析
- **AI驱动**: 使用LLM生成高质量报告
- **多格式输出**: Markdown、HTML、JSON
- **报告分享**: 公开/私有报告链接

### 5. 阅读体验
- **响应式设计**: 支持桌面和移动端
- **深色模式**: 护眼的深色主题
- **阅读进度**: 自动保存阅读位置
- **虚拟列表**: 高性能大量文章渲染
- **离线支持**: PWA离线阅读

## 技术架构

### 前端技术栈
```
Next.js 15 (App Router)
├── React 19
├── TypeScript 5
├── Tailwind CSS 4
├── shadcn/ui
├── tRPC (类型安全API)
├── TanStack Query (数据获取)
└── Zustand (状态管理)
```

### 后端技术栈
```
Next.js API Routes
├── tRPC (类型安全RPC)
├── Prisma (ORM)
├── PostgreSQL (主数据库)
│   └── pgvector (向量搜索)
├── Redis (缓存/队列)
├── BullMQ (任务队列)
└── UploadThing/OSS (文件存储)
```

### AI服务
```
多提供商支持
├── OpenAI (GPT-4o, o1)
├── Anthropic (Claude)
├── DeepSeek (国产高性价比)
└── Ollama (本地部署)
```

### 部署方案
```
Vercel (推荐)
├── 自动部署
├── 边缘网络
└── Serverless函数

或
自托管
├── Docker容器
├── Nginx反向代理
└── PM2进程管理
```

## 数据库设计

### 核心数据表
| 表名 | 用途 | 关键字段 |
|------|------|----------|
| users | 用户管理 | id, email, preferences, ai_config |
| feeds | RSS源 | id, feed_url, category_id, last_fetched_at |
| categories | 分类管理 | id, name, color, parent_id |
| entries | 文章存储 | id, feed_id, content_hash, ai_summary, title_embedding |
| reading_history | 阅读历史 | user_id, entry_id, read_progress |
| search_history | 搜索历史 | user_id, query, results_count |
| ai_analysis_queue | AI分析队列 | entry_id, analysis_type, status |
| reports | 日报周报 | report_type, report_date, content, is_public |
| notifications | 通知管理 | user_id, type, is_read |
| subscription_rules | 订阅规则 | conditions, actions, matched_count |

## 项目结构

```
Rss-Easy/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── migrations/            # 数据库迁移
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # 认证相关页面
│   │   ├── (dashboard)/      # 主应用页面
│   │   ├── api/              # API路由（Webhook等）
│   │   └── layout.tsx        # 根布局
│   ├── components/           # React组件
│   │   ├── ui/              # shadcn/ui组件
│   │   ├── feeds/           # 订阅源组件
│   │   ├── entries/         # 文章组件
│   │   ├── search/          # 搜索组件
│   │   └── reports/         # 报告组件
│   ├── lib/                 # 工具库
│   │   ├── db.ts           # 数据库客户端
│   │   ├── ai/             # AI服务
│   │   ├── rss/            # RSS解析器
│   │   ├── queue/          # 任务队列
│   │   └── utils.ts        # 通用工具
│   ├── server/              # 服务端代码
│   │   ├── api/            # tRPC路由
│   │   ├── services/       # 业务逻辑
│   │   └── jobs/           # 后台任务
│   ├── styles/              # 样式文件
│   └── types/               # TypeScript类型
├── public/                   # 静态资源
├── scripts/                  # 脚本工具
├── tests/                    # 测试文件
└── docs/                     # 文档
```

## 开发阶段

### Phase 1: 基础设施 (1-2周)
- [x] 项目架构设计
- [x] 数据库Schema设计
- [ ] 项目初始化
- [ ] 数据库迁移
- [ ] 基础UI组件库

### Phase 2: RSS核心功能 (2-3周)
- [ ] RSS解析器
- [ ] Feed抓取调度
- [ ] 文章存储和去重
- [ ] 订阅源管理API
- [ ] 基础阅读界面

### Phase 3: AI功能集成 (2-3周)
- [ ] AI服务抽象层
- [ ] 智能摘要生成
- [ ] 智能分类
- [ ] 关键词提取
- [ ] 向量嵌入和存储

### Phase 4: 搜索和推荐 (1-2周)
- [ ] 全文搜索
- [ ] 语义搜索
- [ ] 混合搜索
- [ ] 搜索建议
- [ ] 相关文章推荐

### Phase 5: 报告生成 (1-2周)
- [ ] 日报生成逻辑
- [ ] 周报生成逻辑
- [ ] AI驱动摘要
- [ ] 报告模板
- [ ] 报告分享

### Phase 6: 高级功能 (1-2周)
- [ ] 订阅规则引擎
- [ ] 通知系统
- [ ] 阅读统计
- [ ] 导出功能
- [ ] API密钥管理

### Phase 7: 优化和部署 (1周)
- [ ] 性能优化
- [ ] 错误处理
- [ ] 测试覆盖
- [ ] 部署配置
- [ ] 文档完善

## API设计

### REST API端点
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/webhook/feed-updated | Feed更新Webhook |
| POST | /api/webhook/ai-complete | AI完成Webhook |
| GET | /api/reports/:token/share | 共享报告 |

### tRPC Router
```typescript
appRouter
  ├── feeds      # 订阅源管理
  ├── entries    # 文章管理
  ├── categories # 分类管理
  ├── search     # 搜索功能
  ├── reports    # 报告生成
  ├── stats      # 统计数据
  └── settings   # 用户设置
```

## 环境变量

```env
# 数据库
DATABASE_URL=
DATABASE_URL_POOL_SIZE=

# Redis
REDIS_URL=
REDIS_PASSWORD=

# 认证
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# AI服务
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=

# 文件存储
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=

# 邮件（可选）
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
```

## 测试策略

### 单元测试
- 核心工具函数
- 业务逻辑服务
- AI服务抽象层

### 集成测试
- API端点测试
- 数据库操作测试
- 任务队列测试

### E2E测试
- 关键用户流程
- 跨浏览器测试
- 移动端测试

## 性能目标

| 指标 | 目标 |
|------|------|
| 首页加载 | < 1s |
| RSS抓取 | 100+ feeds/min |
| 搜索响应 | < 200ms |
| AI摘要 | < 5s |
| 报告生成 | < 10s |

## 安全考虑

- [ ] 输入验证（Zod schema）
- [ ] SQL注入防护（Prisma）
- [ ] XSS防护（React默认）
- [ ] CSRF保护（NextAuth）
- [ ] Rate Limiting
- [ ] API密钥管理
- [ ] 敏感数据加密

## 许可证

MIT License
