# RSS 解析器增强文档

## 概述

增强的 RSS 解析器支持更全面的字段解析和更智能的内容提取，特别是针对微信公众号等复杂 RSS 源。

## 增强功能

### 1. 支持更多 RSS/Atom 字段

#### Feed 级别字段
- `title` - Feed 标题
- `description` - Feed 描述
- `link` - Feed 链接
- `language` - 语言
- `lastBuildDate` - 最后更新时间
- `image` - Feed 图标/Logo
- `icon` - 图标 URL
- `managingEditor` - 编辑者
- `webMaster` - 网管
- `pubDate` - 发布日期

#### 条目级别字段
- `title` - 文章标题
- `link` - 文章链接
- `pubDate` / `published` / `created` - 发布日期
- `updated` / `modified` - 更新日期
- `author` / `creator` / `dc:creator` - 作者
- `content:encoded` / `content` - 完整 HTML 内容
- `description` / `summary` - 摘要
- `category` / `categories` / `tags` / `dc:subject` - 分类/标签
- `guid` / `id` - 唯一标识符
- `enclosure` / `enclosures` - 附件（音频、视频等）
- `media:content` / `media:thumbnail` / `media:group` - Media RSS 字段
- `comments` - 评论链接
- `wfw:commentRss` - 评论 RSS
- `slash:comments` - 评论数
- `feedburner:origLink` - FeedBurner 原始链接

### 2. 智能内容提取

#### 2.1 内容字段优先级
```typescript
content:encoded → content → content:html → summary → description → [从链接抓取]
```

#### 2.2 从 HTML 内容提取元数据
特别针对微信公众号格式：
- **作者提取**：
  - 格式1: `<span>作者名</span> <span>日期</span> <span>地点</span>`
  - 格式2: "原创 作者名"
  - 格式3: "作者：作者名"

- **来源提取**：
  - 格式1: "以下文章来源于：来源名"
  - 格式2: `<strong>来源名</strong>`

- **日期提取**：
  - `2026-02-12 07:46`
  - `2026年2月12日`
  - `2月12日`

#### 2.3 图片提取
1. Media RSS 字段 (`media:thumbnail`, `media:content`)
2. Media Group
3. Enclosure（如果是图片类型）
4. 从 HTML 内容中提取第一张 `<img>`

#### 2.4 分类/标签提取
支持多种格式的分类数据：
```xml
<!-- 字符串数组 -->
<category>技术</category>
<category>AI</category>

<!-- 对象格式 -->
<category domain="https://example.com">技术</category>

<!-- Atom 格式 -->
<category term="技术" label="Technology"/>
```

### 3. Enclosure 支持

提取附件信息：
```typescript
{
  url: string;        // 附件 URL
  type?: string;      // MIME 类型
  length?: number;    // 文件大小（字节）
}
```

### 4. 日期解析

支持多种日期格式：
- RFC 822 (`Thu, 12 Feb 2026 07:46:00 +0800`)
- ISO 8601 (`2026-02-12T07:46:00+08:00`)
- 中文格式 (`2026年2月12日`)
- 简短格式 (`2月12日`)

### 5. 图片 URL 处理

自动处理相对路径：
- `//example.com/img.jpg` → `https://example.com/img.jpg`
- `/img.jpg` → `https://domain.com/img.jpg`

## 测试结果

使用微信公众号 RSS 测试（人人都是产品经理）：

```
📊 字段覆盖率:
  标题: 10/10 (100.0%)
  发布日期: 10/10 (100.0%)
  内容(encoded): 10/10 (100.0%)
  纯文本摘要: 10/10 (100.0%)
  描述: 10/10 (100.0%)
  作者: 10/10 (100.0%) ← 从 HTML 内容提取
  来源: 10/10 (100.0%) ← 从 HTML 内容提取
```

## 使用示例

```typescript
import { rssParser } from '@/lib/rss/parser';

// 解析 RSS feed
const feed = await rssParser.parseFeed('https://example.com/feed.xml');

// Feed 信息
console.log(feed.title);        // "Feed 标题"
console.log(feed.image?.url);   // Feed 图标

// 遍历文章
for (const entry of feed.items) {
  console.log(entry.title);           // 文章标题
  console.log(entry.author);          // 作者（支持多种格式）
  console.log(entry.source);          // 来源（从内容提取）
  console.log(entry.content);         // 完整 HTML 内容
  console.log(entry.image);           // 文章图片
  console.log(entry.categories);      // 分类/标签
  console.log(entry.enclosure);       // 附件信息
}
```

## 支持的 RSS 格式

- ✅ RSS 2.0
- ✅ RSS 1.0
- ✅ Atom 1.0
- ✅ Atom 0.3
- ✅ JSON Feed 1.0
- ✅ Media RSS
- ✅ Dublin Core
- ✅ iTunes Podcast（部分支持）

## 特殊处理的 RSS 源

### 微信公众号
- ✅ 从 HTML 内容提取作者
- ✅ 提取来源公众号
- ✅ 提取发布日期
- ✅ 处理图片代理链接
- ✅ 清理微信编辑器特殊标签

### 知乎专栏
- ✅ 支持作者字段
- ✅ 支持图片提取

### Medium
- ✅ 支持 Atom 格式
- ✅ 支持分类标签

## 性能优化

1. **并发解析**：使用 `Promise.all` 并发处理所有条目
2. **重试机制**：自动重试失败的请求（最多3次）
3. **超时控制**：默认10秒超时
4. **内存管理**：大文件分块处理

## 未来改进

- [ ] 支持 RDF 格式
- [ ] 更精确的内容清洗
- [ ] 视频嵌入检测
- [ ] 全文内容抓取优化
- [ ] 缓存机制
- [ ] 增量更新支持

## 测试

运行测试脚本：
```bash
npx tsx scripts/test-rss-parser.ts
```

使用自定义 XML 文件测试：
```bash
# 修改 scripts/test-rss-parser.ts 中的 TEST_XML_PATH
npx tsx scripts/test-rss-parser.ts
```

## 贡献

如果发现问题或有改进建议，请提交 Issue 或 Pull Request。
