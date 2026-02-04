# Rss-Easy API 设计文档

## 概述

Rss-Easy使用tRPC作为主要API框架，提供类型安全的端到端API。同时保留部分REST端点用于Webhook和外部集成。

## tRPC API

### 基础路径
```
/trpc/[router].[procedure]
```

### 认证
所有受保护的API都需要认证通过JWT或Session。

---

## 1. Feeds Router

### feeds.list
获取用户的订阅源列表

```typescript
// 输入
{
  page?: number,        // 默认 1
  limit?: number,       // 默认 20, 最大 100
  sortBy?: string,      // 排序字段
  sortOrder?: 'asc' | 'desc',  // 默认 'desc'
  categoryId?: string,  // 分类ID过滤
  tag?: string,         // 标签过滤
  search?: string,      // 搜索关键词
  isActive?: boolean    // 激活状态过滤
}

// 输出
{
  items: Feed[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

### feeds.byId
获取单个订阅源详情

```typescript
// 输入
{ id: string }

// 输出
Feed
```

### feeds.add
添加新订阅源

```typescript
// 输入
{
  url: string,          // RSS feed URL
  title?: string,       // 自定义标题（可选）
  categoryId?: string,  // 分类ID
  tags?: string[],      // 标签
  fetchInterval?: number,  // 抓取间隔（秒）
  priority?: number     // 优先级 1-10
}

// 输出
Feed
```

### feeds.update
更新订阅源

```typescript
// 输入
{
  id: string,
  url?: string,
  title?: string,
  categoryId?: string,
  tags?: string[],
  fetchInterval?: number,
  priority?: number
}

// 输出
Feed
```

### feeds.delete
删除订阅源

```typescript
// 输入
{ id: string }

// 输出
{ success: true }
```

### feeds.refresh
手动刷新订阅源

```typescript
// 输入
{ id: string }

// 输出
{ success: true }
```

### feeds.bulkAction
批量操作订阅源

```typescript
// 输入
{
  feedIds: string[],
  action: 'activate' | 'deactivate' | 'delete' | 'refresh'
}

// 输出
{ success: true }
```

### feeds.stats
获取订阅源统计信息

```typescript
// 输入
{ id: string }

// 输出
{
  total_entries: number,
  unread_count: number,
  starred_count: number,
  entries_last_7_days: number,
  latest_entry_at: Date | null
}
```

---

## 2. Entries Router

### entries.list
获取文章列表

```typescript
// 输入
{
  page?: number,
  limit?: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
  feedId?: string,        // 订阅源ID过滤
  categoryId?: string,    // 分类ID过滤
  tag?: string,           // 标签过滤
  unreadOnly?: boolean,   // 只显示未读
  starredOnly?: boolean,  // 只显示星标
  archivedOnly?: boolean, // 只显示归档
  search?: string,        // 搜索关键词
  dateFrom?: Date,        // 日期范围开始
  dateTo?: Date,          // 日期范围结束
  aiCategory?: string,    // AI分类过滤
  minImportance?: number  // 最低重要性评分
}

// 输出
{
  items: Entry[],
  pagination: { ... }
}
```

### entries.byId
获取单篇文章详情

```typescript
// 输入
{ id: string }

// 输出
Entry
```

### entries.markAsRead
标记文章为已读

```typescript
// 输入
{
  entryIds: string[],
  readAt?: Date
}

// 输出
{ success: true }
```

### entries.markAsStarred
标记文章星标

```typescript
// 输入
{
  entryIds: string[],
  starred: boolean
}

// 输出
{ success: true }
```

### entries.bulkAction
批量操作文章

```typescript
// 输入
{
  entryIds: string[],
  action: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'delete'
}

// 输出
{ success: true }
```

### entries.analyze
AI分析文章

```typescript
// 输入
{
  entryId: string,
  analysisType: 'summary' | 'category' | 'keywords' | 'sentiment' | 'all',
  config?: {
    provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama',
    model: string,
    enableSummary?: boolean,
    enableCategory?: boolean,
    enableKeywords?: boolean,
    enableSentiment?: boolean,
    maxTokens?: number,
    temperature?: number
  }
}

// 输出
{
  entryId: string,
  summary: string | null,
  keywords: string[],
  category: string | null,
  sentiment: 'positive' | 'neutral' | 'negative' | null,
  importanceScore: number,
  model: string,
  tokensUsed: number,
  cost: number,
  processedAt: Date
}
```

---

## 3. Categories Router

### categories.list
获取分类列表

```typescript
// 输出
Category & {
  feedCount: number,
  unreadCount: number
}[]
```

### categories.add
添加分类

```typescript
// 输入
{
  name: string,
  description?: string,
  color?: string,    // HEX颜色值
  icon?: string,
  parentId?: string,
  sortOrder?: number
}

// 输出
Category
```

### categories.update
更新分类

```typescript
// 输入
{
  id: string,
  name?: string,
  description?: string,
  color?: string,
  icon?: string,
  parentId?: string,
  sortOrder?: number
}

// 输出
Category
```

### categories.delete
删除分类

```typescript
// 输入
{ id: string }

// 输出
{ success: true }
```

---

## 4. Search Router

### search.search
混合搜索（全文+语义）

```typescript
// 输入
{
  query: string,
  limit?: number,        // 默认 20
  offset?: number,       // 默认 0
  categoryId?: string,
  unreadOnly?: boolean,
  starredOnly?: boolean,
  dateFrom?: Date,
  dateTo?: Date
}

// 输出
{
  entries: Entry[],
  totalCount: number,
  searchTime: number,    // 毫秒
  querySuggestions: string[]
}
```

### search.history
获取搜索历史

```typescript
// 输入
{ limit?: number }  // 默认 10

// 输出
SearchHistory[]
```

### search.trending
获取热门搜索

```typescript
// 输出
string[]  // 热门搜索词列表
```

---

## 5. Reports Router

### reports.generate
生成日报/周报

```typescript
// 输入
{
  reportType: 'daily' | 'weekly',
  reportDate: Date,
  format?: 'markdown' | 'html' | 'json',  // 默认 'markdown'
  useAI?: boolean,                         // 默认 true
  includeStats?: boolean,                  // 默认 true
  includeHighlights?: boolean,             // 默认 true
  includeTopics?: boolean,                 // 默认 true
  maxHighlights?: number                   // 默认 10
}

// 输出
Report
```

### reports.list
获取报告列表

```typescript
// 输入
{
  reportType?: 'daily' | 'weekly',
  limit?: number,
  offset?: number
}

// 输出
Report[]
```

### reports.byId
获取单个报告

```typescript
// 输入
{ id: string }

// 输出
Report & {
  entries: {
    entry: Entry & { feed: Feed }
  }[]
}
```

### reports.share
分享/取消分享报告

```typescript
// 输入
{
  id: string,
  isPublic: boolean
}

// 输出
Report  // 包含 shareToken
```

---

## 6. Stats Router

### stats.user
获取用户统计信息

```typescript
// 输出
{
  totalFeeds: number,
  totalEntries: number,
  unreadCount: number,
  starredCount: number,
  entriesLast7Days: number,
  entriesLast30Days: number,
  latestEntryAt: Date | null,
  topFeeds: {
    feedId: string,
    feedTitle: string,
    entryCount: number
  }[],
  topCategories: {
    categoryId: string,
    categoryName: string,
    entryCount: number,
    unreadCount: number
  }[],
  readingActivity: {
    date: Date,
    readCount: number
  }[]
}
```

### stats.activity
获取阅读活动统计

```typescript
// 输入
{ days?: number }  // 默认 30

// 输出
{
  date: Date,
  _count: { id: number }
}[]
```

### stats.topFeeds
获取热门订阅源

```typescript
// 输入
{ limit?: number }  // 默认 10

// 输出
{
  feedId: string,
  _count: { id: number }
}[]
```

---

## 7. Settings Router

### settings.get
获取用户设置

```typescript
// 输出
{
  preferences: {
    theme: 'light' | 'dark' | 'auto',
    language: string,
    itemsPerPage: number,
    autoMarkAsRead: boolean,
    showReadArticles: boolean,
    notificationEnabled: boolean,
    defaultView: 'list' | 'grid' | 'magazine',
    fontSize: number
  },
  aiConfig: {
    provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama',
    model: string,
    enableSummary: boolean,
    enableCategory: boolean,
    enableKeywords: boolean,
    enableSentiment: boolean,
    maxTokens: number,
    temperature: number
  }
}
```

### settings.updatePreferences
更新用户偏好

```typescript
// 输入
Partial<UserPreferences>

// 输出
User
```

### settings.updateAIConfig
更新AI配置

```typescript
// 输入
AIAnalysisConfig

// 输出
User
```

---

## REST API端点

### 健康检查
```http
GET /api/health
```

### Webhook
```http
POST /api/webhook/feed-updated
POST /api/webhook/ai-complete
```

### 报告分享
```http
GET /api/reports/:token/share
```

---

## 错误响应格式

```typescript
{
  error: {
    code: string,
    message: string,
    data?: {
      zodError?: {
        fieldErrors: Record<string, string[]>,
        formErrors: string[]
      }
    }
  }
}
```

## 错误码

| Code | HTTP Status | 描述 |
|------|-------------|------|
| UNAUTHORIZED | 401 | 未认证 |
| FORBIDDEN | 403 | 无权限 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| VALIDATION_ERROR | 422 | 验证失败 |
| INTERNAL_ERROR | 500 | 服务器错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |
