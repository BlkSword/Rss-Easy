/**
 * API密钥设置组件
 */

'use client';

import { useState } from 'react';
import { Key, Plus, Trash2, Copy, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';

export function ApiSettings() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

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

  return (
    <>
      <div className="space-y-6">
        {/* API密钥列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  API密钥
                </CardTitle>
                <CardDescription className="mt-1">
                  API密钥用于访问 Rss-Easy 的 API 接口，请妥善保管
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
                <h4 className="font-medium text-sm">使用API密钥</h4>
                <p className="text-sm text-muted-foreground mt-2">
                  在API请求头中添加 Authorization 字段：
                </p>
                <code className="block mt-2 p-3 rounded-lg bg-background/50 text-xs">
                  Authorization: Bearer your_api_key_here
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
