/**
 * API配置组件
 * 包含 API 密钥管理、API 文档和请求范例
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Book,
  Code,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Shield,
  Zap,
  Lock,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';

// 代码块组件 - 带复制功能
function CodeBlock({
  code,
  language = 'json',
  title,
  copyId,
  copiedId,
  onCopy,
}: {
  code: string;
  language?: string;
  title?: string;
  copyId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const isCopied = copiedId === copyId;

  return (
    <div className="rounded-lg overflow-hidden relative group">
      {/* 头部 */}
      <div className="bg-slate-800 dark:bg-slate-900 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && (
            <span className="text-xs font-medium text-slate-400">{title}</span>
          )}
          {!title && (
            <span className="text-xs font-medium text-slate-400 uppercase">{language}</span>
          )}
        </div>
        <Tooltip content={isCopied ? '已复制' : '复制到剪贴板'} position="left">
          <button
            onClick={() => onCopy(code, copyId)}
            className={cn(
              'p-1.5 rounded-md transition-all',
              isCopied
                ? 'bg-green-500/20 text-green-400'
                : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
            )}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>
      {/* 代码内容 */}
      <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-300 p-3 overflow-x-auto font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// API 端点定义
interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
  auth: 'required' | 'optional' | 'public';
  scope?: string[];
  request?: {
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
  };
  response?: Record<string, unknown>;
}

const apiEndpoints: ApiEndpoint[] = [
  // 订阅源管理
  {
    method: 'GET',
    path: '/api/trpc/feeds.list',
    description: '获取订阅源列表',
    category: '订阅源',
    auth: 'required',
    scope: ['read'],
    request: {
      query: { limit: 20, page: 1 },
    },
    response: {
      items: [
        { id: 'uuid', title: '订阅源名称', url: 'https://example.com/feed.xml', unreadCount: 10 },
      ],
      total: 100,
      hasMore: true,
    },
  },
  {
    method: 'GET',
    path: '/api/trpc/feeds.getById',
    description: '获取单个订阅源详情',
    category: '订阅源',
    auth: 'required',
    scope: ['read'],
    request: { query: { id: 'feed-uuid' } },
    response: {
      id: 'uuid',
      title: '订阅源名称',
      url: 'https://example.com/feed.xml',
      description: '订阅源描述',
      lastFetchedAt: '2024-01-01T00:00:00Z',
      unreadCount: 10,
      totalCount: 100,
    },
  },
  {
    method: 'POST',
    path: '/api/trpc/feeds.create',
    description: '添加新订阅源',
    category: '订阅源',
    auth: 'required',
    scope: ['write'],
    request: {
      body: { url: 'https://example.com/feed.xml', categoryId: 'optional-category-uuid' },
    },
    response: { success: true, feed: { id: 'uuid', title: '新订阅源' } },
  },
  {
    method: 'POST',
    path: '/api/trpc/feeds.fetch',
    description: '手动抓取订阅源',
    category: '订阅源',
    auth: 'required',
    scope: ['write'],
    request: { body: { feedId: 'feed-uuid' } },
    response: { success: true, newEntries: 5 },
  },
  {
    method: 'DELETE',
    path: '/api/trpc/feeds.delete',
    description: '删除订阅源',
    category: '订阅源',
    auth: 'required',
    scope: ['write'],
    request: { body: { id: 'feed-uuid' } },
    response: { success: true },
  },

  // 文章管理
  {
    method: 'GET',
    path: '/api/trpc/entries.list',
    description: '获取文章列表',
    category: '文章',
    auth: 'required',
    scope: ['read'],
    request: {
      query: { limit: 20, page: 1, unreadOnly: false, feedId: 'optional-feed-uuid' },
    },
    response: {
      items: [
        {
          id: 'uuid',
          title: '文章标题',
          url: 'https://example.com/article',
          summary: '文章摘要',
          isRead: false,
          isStarred: false,
          publishedAt: '2024-01-01T00:00:00Z',
        },
      ],
      total: 100,
      hasMore: true,
    },
  },
  {
    method: 'GET',
    path: '/api/trpc/entries.getById',
    description: '获取文章详情',
    category: '文章',
    auth: 'required',
    scope: ['read'],
    request: { query: { id: 'entry-uuid' } },
    response: {
      id: 'uuid',
      title: '文章标题',
      url: 'https://example.com/article',
      content: '<p>完整 HTML 内容</p>',
      summary: '文章摘要',
      aiSummary: 'AI 生成的摘要',
      aiKeywords: ['关键词1', '关键词2'],
      isRead: false,
      isStarred: false,
      publishedAt: '2024-01-01T00:00:00Z',
    },
  },
  {
    method: 'POST',
    path: '/api/trpc/entries.markAsRead',
    description: '标记文章为已读',
    category: '文章',
    auth: 'required',
    scope: ['write'],
    request: { body: { entryIds: ['uuid1', 'uuid2'] } },
    response: { success: true },
  },
  {
    method: 'POST',
    path: '/api/trpc/entries.toggleStar',
    description: '切换文章星标状态',
    category: '文章',
    auth: 'required',
    scope: ['write'],
    request: { body: { id: 'entry-uuid' } },
    response: { success: true, isStarred: true },
  },

  // 分类管理
  {
    method: 'GET',
    path: '/api/trpc/categories.list',
    description: '获取分类列表',
    category: '分类',
    auth: 'required',
    scope: ['read'],
    response: {
      categories: [
        { id: 'uuid', name: '技术', color: '#00b0f0', unreadCount: 50, feedCount: 10 },
      ],
    },
  },
  {
    method: 'POST',
    path: '/api/trpc/categories.create',
    description: '创建分类',
    category: '分类',
    auth: 'required',
    scope: ['write'],
    request: { body: { name: '新分类', color: '#ff6b6b', parentId: 'optional-parent-uuid' } },
    response: { success: true, category: { id: 'uuid', name: '新分类' } },
  },

  // 搜索
  {
    method: 'GET',
    path: '/api/trpc/search.search',
    description: '全文搜索文章',
    category: '搜索',
    auth: 'required',
    scope: ['read'],
    request: { query: { query: '关键词', limit: 20, mode: 'fulltext' } },
    response: {
      items: [
        {
          id: 'uuid',
          title: '匹配的文章',
          highlight: '包含<mark>关键词</mark>的片段',
          score: 0.95,
        },
      ],
      total: 50,
    },
  },
  {
    method: 'GET',
    path: '/api/trpc/search.semantic',
    description: '语义搜索文章（需要 AI 配置）',
    category: '搜索',
    auth: 'required',
    scope: ['read'],
    request: { query: { query: '与机器学习相关的内容', limit: 10 } },
    response: {
      items: [
        {
          id: 'uuid',
          title: '相关文章',
          similarity: 0.85,
        },
      ],
      total: 15,
    },
  },

  // 认证
  {
    method: 'POST',
    path: '/api/auth/login',
    description: '用户登录（获取 Session）',
    category: '认证',
    auth: 'public',
    request: { body: { email: 'user@example.com', password: 'password123' } },
    response: { success: true, user: { id: 'uuid', email: 'user@example.com', username: '用户名' } },
  },
  {
    method: 'POST',
    path: '/api/auth/register',
    description: '用户注册',
    category: '认证',
    auth: 'public',
    request: { body: { email: 'user@example.com', password: 'password123', username: '用户名' } },
    response: { success: true },
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    description: '获取当前用户信息',
    category: '认证',
    auth: 'required',
    response: { id: 'uuid', email: 'user@example.com', username: '用户名' },
  },

  // REST API
  {
    method: 'POST',
    path: '/api/webhook/feed',
    description: 'Webhook 触发订阅源抓取',
    category: 'Webhook',
    auth: 'required',
    scope: ['write'],
    request: { body: { feedId: 'feed-uuid', secret: 'webhook-secret' } },
    response: { success: true, message: '抓取任务已触发' },
  },
];

// 按分类分组端点
const categoryOrder = ['订阅源', '文章', '分类', '搜索', '认证', 'Webhook'];
const groupedEndpoints = categoryOrder.reduce((acc, category) => {
  acc[category] = apiEndpoints.filter((e) => e.category === category);
  return acc;
}, {} as Record<string, ApiEndpoint[]>);

// 权限范围说明
const scopeDescriptions: Record<string, { label: string; description: string }> = {
  read: { label: '读取', description: '允许读取所有数据（订阅源、文章、分类等）' },
  write: { label: '写入', description: '允许创建、更新、删除数据' },
};

// 代码示例
const codeExamples = {
  javascript: {
    title: 'JavaScript / Fetch',
    code: `// 获取订阅源列表
const response = await fetch(
  'https://your-domain.com/api/trpc/feeds.list?input=' +
    encodeURIComponent(JSON.stringify({ limit: 20, page: 1 })),
  {
    headers: {
      'Authorization': 'Bearer rss_your_api_key_here',
      'Content-Type': 'application/json',
    },
  }
);

const data = await response.json();
console.log(data.result.data);`,
  },
  python: {
    title: 'Python / Requests',
    code: `import requests
import json

# API 配置
BASE_URL = 'https://your-domain.com'
API_KEY = 'rss_your_api_key_here'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json',
}

# 获取订阅源列表
params = {'input': json.dumps({'limit': 20, 'page': 1})}
response = requests.get(
    f'{BASE_URL}/api/trpc/feeds.list',
    headers=headers,
    params=params
)

data = response.json()
print(data['result']['data'])

# 标记文章已读
response = requests.post(
    f'{BASE_URL}/api/trpc/entries.markAsRead',
    headers=headers,
    json={'entryIds': ['uuid1', 'uuid2']}
)
print(response.json())`,
  },
  curl: {
    title: 'cURL',
    code: `# 获取订阅源列表
curl -X GET 'https://your-domain.com/api/trpc/feeds.list?input=%7B%22limit%22%3A20%7D' \\
  -H 'Authorization: Bearer rss_your_api_key_here' \\
  -H 'Content-Type: application/json'

# 标记文章已读
curl -X POST 'https://your-domain.com/api/trpc/entries.markAsRead' \\
  -H 'Authorization: Bearer rss_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{"entryIds": ["uuid1", "uuid2"]}'

# 搜索文章
curl -X GET 'https://your-domain.com/api/trpc/search.search?input=%7B%22query%22%3A%22%E5%85%B3%E9%94%AE%E8%AF%8D%22%7D' \\
  -H 'Authorization: Bearer rss_your_api_key_here'`,
  },
  typescript: {
    title: 'TypeScript / tRPC Client',
    code: `import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'rss-easy-types'; // 需要导出类型

// 创建 tRPC 客户端
const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://your-domain.com/api/trpc',
      headers: () => ({
        Authorization: 'Bearer rss_your_api_key_here',
      }),
    }),
  ],
});

// 类型安全的 API 调用
async function main() {
  // 获取订阅源列表
  const feeds = await client.feeds.list.query({ limit: 20 });
  console.log(feeds.items);

  // 获取文章详情
  const entry = await client.entries.getById.query({ id: 'entry-uuid' });
  console.log(entry.title);

  // 标记已读
  await client.entries.markAsRead.mutate({ entryIds: ['uuid1'] });
}

main();`,
  },
};

export function ApiSettings() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('订阅源');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: apiKeys = [], refetch } = trpc.settings.getApiKeys.useQuery();
  const { mutateAsync: createKey } = trpc.settings.createApiKey.useMutation();
  const { mutate: deleteKey } = trpc.settings.deleteApiKey.useMutation();

  // 复制到剪贴板
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      notifySuccess('已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      notifyError('复制失败');
    }
  }, []);

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      notifyError('请输入密钥名称');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createKey({ name: keyName.trim(), expiresIn });
      setCreatedKey(result.key);
      setIsCreateModalOpen(false);
      setKeyName('');
      setExpiresIn(0);
      refetch();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string, name: string) => {
    if (!confirm(`确定要删除密钥 "${name}" 吗？此操作无法撤销。`)) return;

    try {
      await deleteKey({ id });
      notifySuccess('API密钥已删除');
      refetch();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      handleCopy(createdKey, 'created-key');
    }
  };

  const handleCloseKeyModal = () => {
    setCreatedKey(null);
  };

  const toggleEndpoint = (path: string) => {
    setExpandedEndpoint(expandedEndpoint === path ? null : path);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500/20 text-green-600 dark:text-green-400';
      case 'POST':
        return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
      case 'PUT':
        return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
      case 'DELETE':
        return 'bg-red-500/20 text-red-600 dark:text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-600';
    }
  };

  return (
    <>
      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keys">API 密钥</TabsTrigger>
          <TabsTrigger value="docs">API 文档</TabsTrigger>
          <TabsTrigger value="examples">请求范例</TabsTrigger>
        </TabsList>

        {/* API 密钥管理 */}
        <TabsContent value="keys" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    API 密钥管理
                  </CardTitle>
                  <CardDescription className="mt-1">
                    API 密钥用于访问 Rss-Easy 的 API 接口，请妥善保管
                  </CardDescription>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  创建密钥
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Key className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">暂无API密钥</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    创建API密钥以便通过API访问您的数据
                  </p>
                  <Button
                    variant="outline"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    创建第一个密钥
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key: any) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 transition-all bg-muted/20"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{key.name}</div>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                          <code className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                            {key.key}
                          </code>
                          <span>创建于 {new Date(key.createdAt).toLocaleDateString('zh-CN')}</span>
                          {key.lastUsedAt && (
                            <span>· 最后使用 {new Date(key.lastUsedAt).toLocaleDateString('zh-CN')}</span>
                          )}
                          {key.expiresAt && (
                            <span className="text-amber-600">
                              · 过期于 {new Date(key.expiresAt).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </div>
                        {/* 权限标签 */}
                        <div className="flex gap-1 mt-2">
                          {key.scopes?.map((scope: string) => (
                            <span
                              key={scope}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                            >
                              {scopeDescriptions[scope]?.label || scope}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(key.id, key.name)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">使用 API 密钥</h4>
                  <p className="text-sm text-muted-foreground mt-2">
                    在 API 请求头中添加 Authorization 字段：
                  </p>
                  <div className="mt-3">
                    <CodeBlock
                      code="Authorization: Bearer rss_your_api_key_here"
                      language="http"
                      title="请求头"
                      copyId="auth-header"
                      copiedId={copiedId}
                      onCopy={handleCopy}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API 文档 */}
        <TabsContent value="docs" className="space-y-6">
          {/* 概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5 text-primary" />
                API 概览
              </CardTitle>
              <CardDescription>
                Rss-Easy 提供基于 tRPC 的类型安全 API，支持 REST 风格调用
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 特性 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">类型安全</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    基于 tRPC 的端到端类型推导，TypeScript 原生支持
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">权限控制</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    细粒度的 API 密钥权限管理，支持读写分离
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">跨平台</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    标准 HTTP 协议，支持任何编程语言调用
                  </p>
                </div>
              </div>

              {/* 认证方式 */}
              <div className="pt-4 border-t border-border/60">
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  认证方式
                </h3>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <strong>推荐方式：</strong>在请求头中携带 API 密钥
                  </div>
                  <CodeBlock
                    code={`# HTTP Header
Authorization: Bearer rss_xxxxxxxxxxxxxxxx

# cURL 示例
curl -H "Authorization: Bearer rss_xxxxxxxxxxxxxxxx" \\
  https://your-domain.com/api/trpc/feeds.list`}
                    language="bash"
                    title="认证示例"
                    copyId="auth-example"
                    copiedId={copiedId}
                    onCopy={handleCopy}
                  />
                </div>
              </div>

              {/* 权限范围 */}
              <div className="pt-4 border-t border-border/60">
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary" />
                  权限范围 (Scopes)
                </h3>
                <div className="space-y-2">
                  {Object.entries(scopeDescriptions).map(([scope, info]) => (
                    <div key={scope} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                      <code className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                        {scope}
                      </code>
                      <div>
                        <div className="font-medium text-sm">{info.label}</div>
                        <div className="text-xs text-muted-foreground">{info.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 错误码 */}
              <div className="pt-4 border-t border-border/60">
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  HTTP 状态码
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {[
                    { code: 200, desc: '请求成功', color: 'text-green-500' },
                    { code: 400, desc: '请求参数错误', color: 'text-amber-500' },
                    { code: 401, desc: '未授权', color: 'text-red-500' },
                    { code: 403, desc: '无权限', color: 'text-red-500' },
                    { code: 404, desc: '资源不存在', color: 'text-amber-500' },
                    { code: 500, desc: '服务器错误', color: 'text-red-500' },
                  ].map(({ code, desc, color }) => (
                    <div key={code} className="flex items-center gap-2 p-2 rounded bg-muted/20">
                      <span className={cn('font-mono text-xs', color)}>{code}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 端点列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                API 端点
              </CardTitle>
              <CardDescription>
                按分类浏览所有可用的 API 端点
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {Object.entries(groupedEndpoints).map(([category, endpoints]) => (
                  <div key={category}>
                    {/* 分类标题 */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{category}</span>
                        <span className="text-xs text-muted-foreground">
                          {endpoints.length} 个端点
                        </span>
                      </div>
                      {expandedCategory === category ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* 端点列表 */}
                    {expandedCategory === category && (
                      <div className="border-t border-border bg-muted/10">
                        {endpoints.map((endpoint) => (
                          <div key={endpoint.path} className="border-b border-border/50 last:border-b-0">
                            {/* 端点标题 */}
                            <button
                              onClick={() => toggleEndpoint(endpoint.path)}
                              className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-mono',
                                  getMethodColor(endpoint.method)
                                )}>
                                  {endpoint.method}
                                </span>
                                <code className="text-sm">{endpoint.path}</code>
                                <span className="text-xs text-muted-foreground hidden md:inline">
                                  {endpoint.description}
                                </span>
                              </div>
                              {expandedEndpoint === endpoint.path ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>

                            {/* 端点详情 */}
                            {expandedEndpoint === endpoint.path && (
                              <div className="p-4 bg-muted/20 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                    {endpoint.category}
                                  </span>
                                  <span className={cn(
                                    'text-xs px-2 py-0.5 rounded',
                                    endpoint.auth === 'public'
                                      ? 'bg-green-500/10 text-green-600'
                                      : 'bg-amber-500/10 text-amber-600'
                                  )}>
                                    {endpoint.auth === 'public' ? '公开' : '需要认证'}
                                  </span>
                                  {endpoint.scope && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                                      需要: {endpoint.scope.join(', ')}
                                    </span>
                                  )}
                                </div>

                                <p className="text-sm">{endpoint.description}</p>

                                {endpoint.request?.query && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-2">Query 参数</div>
                                    <CodeBlock
                                      code={JSON.stringify(endpoint.request.query, null, 2)}
                                      language="json"
                                      copyId={`query-${endpoint.path}`}
                                      copiedId={copiedId}
                                      onCopy={handleCopy}
                                    />
                                  </div>
                                )}

                                {endpoint.request?.body && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-2">请求体</div>
                                    <CodeBlock
                                      code={JSON.stringify(endpoint.request.body, null, 2)}
                                      language="json"
                                      copyId={`body-${endpoint.path}`}
                                      copiedId={copiedId}
                                      onCopy={handleCopy}
                                    />
                                  </div>
                                )}

                                {endpoint.response && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-2">响应示例</div>
                                    <CodeBlock
                                      code={JSON.stringify(endpoint.response, null, 2)}
                                      language="json"
                                      copyId={`response-${endpoint.path}`}
                                      copiedId={copiedId}
                                      onCopy={handleCopy}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 请求范例 */}
        <TabsContent value="examples" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                代码示例
              </CardTitle>
              <CardDescription>
                常用编程语言的 API 调用示例
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(codeExamples).map(([lang, example]) => (
                <div key={lang} className="space-y-2">
                  <h3 className="font-medium text-sm">{example.title}</h3>
                  <CodeBlock
                    code={example.code}
                    language={lang}
                    copyId={`example-${lang}`}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 常见场景 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                常见场景
              </CardTitle>
              <CardDescription>
                典型使用场景的代码示例
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 场景1: 获取未读文章 */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">获取所有未读文章</h3>
                <CodeBlock
                  code={`// 获取所有未读文章
const response = await fetch(
  'https://your-domain.com/api/trpc/entries.list?input=' +
    encodeURIComponent(JSON.stringify({ unreadOnly: true, limit: 100 })),
  {
    headers: { 'Authorization': 'Bearer rss_your_api_key' }
  }
);
const { result } = await response.json();
console.log(\`共有 \${result.data.total} 篇未读文章\`);`}
                  language="javascript"
                  copyId="scene-unread"
                  copiedId={copiedId}
                  onCopy={handleCopy}
                />
              </div>

              {/* 场景2: 批量标记已读 */}
              <div className="space-y-2 pt-4 border-t border-border/60">
                <h3 className="font-medium text-sm">批量标记文章已读</h3>
                <CodeBlock
                  code={`// 批量标记已读
const entryIds = ['uuid1', 'uuid2', 'uuid3'];

const response = await fetch('https://your-domain.com/api/trpc/entries.markAsRead', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer rss_your_api_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ entryIds }),
});

const { result } = await response.json();
console.log('标记结果:', result.data);`}
                  language="javascript"
                  copyId="scene-batch-read"
                  copiedId={copiedId}
                  onCopy={handleCopy}
                />
              </div>

              {/* 场景3: 搜索文章 */}
              <div className="space-y-2 pt-4 border-t border-border/60">
                <h3 className="font-medium text-sm">全文搜索文章</h3>
                <CodeBlock
                  code={`// 搜索包含关键词的文章
const keyword = '机器学习';

const response = await fetch(
  'https://your-domain.com/api/trpc/search.search?input=' +
    encodeURIComponent(JSON.stringify({ query: keyword, limit: 20 })),
  {
    headers: { 'Authorization': 'Bearer rss_your_api_key' }
  }
);

const { result } = await response.json();
console.log(\`找到 \${result.data.total} 篇相关文章:\`);
result.data.items.forEach(item => {
  console.log(\`- \${item.title}\`);
});`}
                  language="javascript"
                  copyId="scene-search"
                  copiedId={copiedId}
                  onCopy={handleCopy}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 创建密钥弹窗 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="创建API密钥"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateKey}
              isLoading={isCreating}
              disabled={!keyName.trim() || isCreating}
            >
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              创建后请立即复制密钥，关闭窗口后将无法再次查看完整密钥
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">密钥名称</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="例如：我的应用"
              className={cn(
                'w-full px-4 py-2.5 rounded-lg border border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200'
              )}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">过期时间（天）</label>
            <input
              type="number"
              value={expiresIn}
              onChange={(e) => setExpiresIn(Number(e.target.value))}
              min={0}
              max={365}
              placeholder="0表示永不过期"
              className={cn(
                'w-full px-4 py-2.5 rounded-lg border border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200'
              )}
            />
            <p className="text-xs text-muted-foreground">设置为 0 表示永不过期，最多 365 天</p>
          </div>
        </div>
      </Modal>

      {/* 显示创建的密钥 */}
      <Modal
        isOpen={!!createdKey}
        onClose={handleCloseKeyModal}
        title="API密钥已创建"
        size="md"
        footer={
          <Button variant="primary" onClick={handleCloseKeyModal}>
            我已保存密钥
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              请立即复制并保存此密钥，关闭此窗口后将无法再次查看完整密钥
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">您的API密钥</label>
            <CodeBlock
              code={createdKey || ''}
              language="text"
              title="API Key"
              copyId="created-key"
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

export default ApiSettings;
