/**
 * API配置组件
 * 包含 API 密钥管理、API 文档和请求范例
 */

'use client';

import { useState } from 'react';
import { Key, Plus, Trash2, Copy, AlertCircle, Book, Code, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  request?: {
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, any>;
  };
  response?: any;
}

const apiEndpoints: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/trpc/feeds.list',
    description: '获取订阅源列表',
    request: {
      query: {
        limit: 20,
        page: 1,
      },
    },
    response: {
      items: [
        {
          id: 'uuid',
          title: '订阅源名称',
          url: 'https://example.com/feed.xml',
          unreadCount: 10,
        },
      ],
      total: 100,
    },
  },
  {
    method: 'GET',
    path: '/api/trpc/entries.list',
    description: '获取文章列表',
    request: {
      query: {
        limit: 20,
        page: 1,
        unreadOnly: false,
      },
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
    },
  },
  {
    method: 'POST',
    path: '/api/trpc/entries.markAsRead',
    description: '标记文章为已读',
    request: {
      body: {
        entryIds: ['uuid1', 'uuid2'],
      },
    },
    response: {
      success: true,
    },
  },
  {
    method: 'GET',
    path: '/api/trpc/categories.list',
    description: '获取分类列表',
    response: {
      categories: [
        {
          id: 'uuid',
          name: '技术',
          color: '#00b0f0',
          unreadCount: 50,
        },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/trpc/search.search',
    description: '搜索文章',
    request: {
      query: {
        query: '关键词',
        limit: 20,
      },
    },
    response: {
      items: [],
      total: 0,
    },
  },
];

export function ApiSettings() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const { data: apiKeys = [], refetch } = trpc.settings.getApiKeys.useQuery();
  const { mutateAsync: createKey } = trpc.settings.createApiKey.useMutation();
  const { mutate: deleteKey } = trpc.settings.deleteApiKey.useMutation();

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
      navigator.clipboard.writeText(createdKey);
      notifySuccess('已复制到剪贴板');
    }
  };

  const handleCloseKeyModal = () => {
    setCreatedKey(null);
  };

  const toggleEndpoint = (path: string) => {
    setExpandedEndpoint(expandedEndpoint === path ? null : path);
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
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                          <code className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                            {key.key}
                          </code>
                          <span>创建于 {new Date(key.createdAt).toLocaleDateString('zh-CN')}</span>
                          {key.lastUsedAt && (
                            <span>· 最后使用 {new Date(key.lastUsedAt).toLocaleDateString('zh-CN')}</span>
                          )}
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
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">使用 API 密钥</h4>
                  <p className="text-sm text-muted-foreground mt-2">
                    在 API 请求头中添加 Authorization 字段：
                  </p>
                  <code className="block mt-2 p-3 rounded-lg bg-background/50 text-xs">
                    Authorization: Bearer your_api_key_here
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API 文档 */}
        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5 text-primary" />
                API 文档
              </CardTitle>
              <CardDescription>
                Rss-Easy 提供 tRPC 和 REST API 两种方式访问数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* tRPC API */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  tRPC API
                </h3>
                <p className="text-sm text-muted-foreground">
                  tRPC API 提供端到端类型安全，推荐用于 TypeScript/JavaScript 项目。
                </p>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">可用路由：</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-muted/30">
                      <code className="text-xs">feeds.*</code> - 订阅源管理
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <code className="text-xs">entries.*</code> - 文章管理
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <code className="text-xs">categories.*</code> - 分类管理
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <code className="text-xs">search.*</code> - 搜索功能
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <code className="text-xs">notifications.*</code> - 通知管理
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <code className="text-xs">settings.*</code> - 设置管理
                    </div>
                  </div>
                </div>
              </div>

              {/* REST API */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  REST API
                </h3>
                <p className="text-sm text-muted-foreground">
                  标准 REST API，支持任何 HTTP 客户端。
                </p>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">可用端点：</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 text-xs font-mono">GET</span>
                      <code className="text-xs">/api/auth/login</code> - 用户登录
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 text-xs font-mono">GET</span>
                      <code className="text-xs">/api/auth/register</code> - 用户注册
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 text-xs font-mono">POST</span>
                      <code className="text-xs">/api/webhook/feed</code> - Webhook 订阅
                    </div>
                  </div>
                </div>
              </div>

              {/* 认证说明 */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  认证方式
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>所有 API 请求都需要在 Header 中携带 API 密钥：</p>
                  <code className="block p-3 rounded-lg bg-background/50 text-xs">
                    Authorization: Bearer your_api_key_here
                  </code>
                  <p className="text-xs">或使用查询参数（不推荐，仅用于测试）：</p>
                  <code className="block p-3 rounded-lg bg-background/50 text-xs">
                    ?apikey=your_api_key_here
                  </code>
                </div>
              </div>

              {/* 错误处理 */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  错误响应
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="font-mono text-xs mb-2">HTTP 状态码</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>200 - 请求成功</div>
                      <div>400 - 请求参数错误</div>
                      <div>401 - 未授权（API 密钥无效）</div>
                      <div>403 - 无权限访问</div>
                      <div>404 - 资源不存在</div>
                      <div>500 - 服务器错误</div>
                    </div>
                  </div>
                </div>
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
                请求范例
              </CardTitle>
              <CardDescription>
                常用场景的 API 请求示例代码
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* JavaScript/Node.js */}
              <div className="space-y-3">
                <h3 className="font-medium">JavaScript / Node.js</h3>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">获取订阅源列表</div>
                  <pre className="p-4 rounded-lg bg-muted/30 text-xs overflow-x-auto">
                    <code>{`const response = await fetch('https://your-domain.com/api/trpc/feeds.list?input=${encodeURIComponent(JSON.stringify({ limit: 20, page: 1 }))}', {
  headers: {
    'Authorization': 'Bearer your_api_key_here',
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
console.log(data.result.data);`}</code>
                  </pre>
                </div>
              </div>

              {/* Python */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium">Python</h3>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">获取文章列表</div>
                  <pre className="p-4 rounded-lg bg-muted/30 text-xs overflow-x-auto">
                    <code>{`import requests

headers = {
    'Authorization': 'Bearer your_api_key_here',
    'Content-Type': 'application/json',
}

params = {
    'input': json.dumps({'limit': 20, 'page': 1})
}

response = requests.get(
    'https://your-domain.com/api/trpc/entries.list',
    headers=headers,
    params=params
)

data = response.json()
print(data['result']['data'])`}</code>
                  </pre>
                </div>
              </div>

              {/* curl */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium">cURL</h3>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">标记文章为已读</div>
                  <pre className="p-4 rounded-lg bg-muted/30 text-xs overflow-x-auto">
                    <code>{`curl -X POST 'https://your-domain.com/api/trpc/entries.markAsRead' \\
  -H 'Authorization: Bearer your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "entryIds": ["uuid1", "uuid2"]
  }'`}</code>
                  </pre>
                </div>
              </div>

              {/* TypeScript */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium">TypeScript (tRPC)</h3>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">使用 tRPC 客户端</div>
                  <pre className="p-4 rounded-lg bg-muted/30 text-xs overflow-x-auto">
                    <code>{`import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './types';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://your-domain.com/api/trpc',
      headers: () => ({
        Authorization: 'Bearer your_api_key_here',
      }),
    }),
  ],
});

// 类型安全的 API 调用
const feeds = await client.feeds.list.query({ limit: 20 });
console.log(feeds.items);`}</code>
                  </pre>
                </div>
              </div>

              {/* 端点展开示例 */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="font-medium">端点详情</h3>
                <div className="space-y-2">
                  {apiEndpoints.map((endpoint) => (
                    <div key={endpoint.path} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleEndpoint(endpoint.path)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-mono',
                            endpoint.method === 'GET' && 'bg-green-500/20 text-green-600',
                            endpoint.method === 'POST' && 'bg-blue-500/20 text-blue-600',
                            endpoint.method === 'PUT' && 'bg-amber-500/20 text-amber-600',
                            endpoint.method === 'DELETE' && 'bg-red-500/20 text-red-600'
                          )}>
                            {endpoint.method}
                          </span>
                          <code className="text-sm">{endpoint.path}</code>
                        </div>
                        {expandedEndpoint === endpoint.path ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {expandedEndpoint === endpoint.path && (
                        <div className="p-4 border-t bg-muted/10 space-y-3">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">描述</div>
                            <div className="text-sm">{endpoint.description}</div>
                          </div>
                          {endpoint.request && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">请求</div>
                              <pre className="p-3 rounded bg-background/50 text-xs overflow-x-auto">
                                <code>{JSON.stringify(endpoint.request, null, 2)}</code>
                              </pre>
                            </div>
                          )}
                          {endpoint.response && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">响应</div>
                              <pre className="p-3 rounded bg-background/50 text-xs overflow-x-auto">
                                <code>{JSON.stringify(endpoint.response, null, 2)}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
            <div className="relative">
              <textarea
                value={createdKey || ''}
                readOnly
                rows={3}
                className={cn(
                  'w-full px-4 py-3 rounded-lg border border-border bg-muted/30 font-mono text-sm',
                  'focus:outline-none'
                )}
              />
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={handleCopyKey}
            leftIcon={<Copy className="h-4 w-4" />}
          >
            复制密钥
          </Button>
        </div>
      </Modal>
    </>
  );
}
