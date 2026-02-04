/**
 * 验证工具
 * 基于Zod的数据验证schema
 */

import { z } from 'zod';

// =====================================================
// 通用验证
// =====================================================

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// =====================================================
// Feed验证
// =====================================================

export const createFeedSchema = z.object({
  url: z.string().url('请输入有效的URL'),
  title: z.string().min(1).max(500).optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  fetchInterval: z.number().min(60).max(86400).optional(),
  priority: z.number().min(1).max(10).optional(),
});

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = createFeedSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateFeedInput = z.infer<typeof updateFeedSchema>;

export const feedListQuerySchema = paginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type FeedListQuery = z.infer<typeof feedListQuerySchema>;

// =====================================================
// Entry验证
// =====================================================

export const entryListQuerySchema = paginationSchema.extend({
  feedId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  tag: z.string().optional(),
  unreadOnly: z.boolean().default(false),
  starredOnly: z.boolean().default(false),
  archivedOnly: z.boolean().default(false),
  search: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  aiCategory: z.string().optional(),
  minImportance: z.number().min(0).max(1).optional(),
});

export type EntryListQuery = z.infer<typeof entryListQuerySchema>;

export const bulkActionSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['markRead', 'markUnread', 'star', 'unstar', 'archive', 'unarchive', 'delete']),
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;

// =====================================================
// Category验证
// =====================================================

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// =====================================================
// 搜索验证
// =====================================================

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  categoryId: z.string().uuid().optional(),
  unreadOnly: z.boolean().default(false),
  starredOnly: z.boolean().default(false),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// =====================================================
// 报告验证
// =====================================================

export const generateReportSchema = z.object({
  reportType: z.enum(['daily', 'weekly']),
  reportDate: z.date(),
  format: z.enum(['markdown', 'html', 'json']).default('markdown'),
  useAI: z.boolean().default(true),
  includeStats: z.boolean().default(true),
  includeHighlights: z.boolean().default(true),
  includeTopics: z.boolean().default(true),
  maxHighlights: z.number().min(1).max(50).default(10),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// =====================================================
// AI配置验证
// =====================================================

export const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'ollama']),
  model: z.string().min(1),
  enableSummary: z.boolean().default(true),
  enableCategory: z.boolean().default(true),
  enableKeywords: z.boolean().default(true),
  enableSentiment: z.boolean().default(false),
  maxTokens: z.number().min(100).max(32000).default(2000),
  temperature: z.number().min(0).max(2).default(0.7),
});

export type AIConfig = z.infer<typeof aiConfigSchema>;

// =====================================================
// 用户偏好验证
// =====================================================

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('dark'),
  language: z.string().default('zh-CN'),
  itemsPerPage: z.number().min(10).max(200).default(50),
  autoMarkAsRead: z.boolean().default(false),
  showReadArticles: z.boolean().default(false),
  notificationEnabled: z.boolean().default(true),
  defaultView: z.enum(['list', 'grid', 'magazine']).default('list'),
  fontSize: z.number().min(12).max(24).default(16),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

// =====================================================
// 订阅规则验证
// =====================================================

export const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  conditions: z.object({
    feedId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    titleContains: z.array(z.string()).optional(),
    contentContains: z.array(z.string()).optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  actions: z.object({
    addTags: z.array(z.string()).optional(),
    setCategory: z.string().uuid().optional(),
    markAsRead: z.boolean().optional(),
    setStarred: z.boolean().optional(),
    setPriority: z.number().min(1).max(10).optional(),
  }),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
