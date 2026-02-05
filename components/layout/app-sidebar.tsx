'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Rss,
  Folder,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Button, Badge, Skeleton, Modal, Input } from 'antd';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';

export function AppSidebar() {
  const pathname = usePathname();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

  const { data: categories, isLoading, refetch } = trpc.categories.list.useQuery();
  const { data: feeds } = trpc.feeds.list.useQuery({ limit: 100 });

  const createCategory = trpc.categories.create.useMutation();

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      notifyError('请输入分组名称');
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: newCategoryName,
        color: newCategoryColor,
      });
      notifySuccess('分组创建成功');
      setNewCategoryName('');
      setNewCategoryColor('#3b82f6');
      setIsCreateModalOpen(false);
      refetch();
    } catch (error) {
      notifyError('创建失败', error instanceof Error ? error.message : '');
    }
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside className="h-full bg-background/30 overflow-y-auto">
      <div className="p-3 space-y-4">
        <nav className="space-y-0.5">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 rounded-md transition-all text-left',
              isActive('/')
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted/30 text-foreground'
            )}
          >
            <Rss className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1 text-xs font-medium">全部文章</span>
          </Link>
        </nav>

        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              分组
            </span>
            <Button
              type="text"
              size="small"
              icon={<Plus className="h-3 w-3" />}
              className="h-6 w-6 p-0"
              title="新建分组"
              onClick={() => setIsCreateModalOpen(true)}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <Skeleton.Input key={i} active size="small" className="w-full" />
              ))}
            </div>
          ) : (
            <nav className="space-y-0.5">
              {categories?.map((category) => {
                const isOpen = openCategories.has(category.id);
                const hasFeeds = category._count.feeds > 0;

                return (
                  <div key={category.id}>
                    <button
                      onClick={() => hasFeeds && toggleCategory(category.id)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-md transition-all text-left',
                        hasFeeds && 'hover:bg-muted/30',
                        !hasFeeds && 'opacity-50 cursor-not-allowed'
                      )}
                      disabled={!hasFeeds}
                    >
                      {hasFeeds ? (
                        isOpen ? (
                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 rotate-90 transition-transform" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform" />
                        )
                      ) : (
                        <span className="w-3 flex-shrink-0" />
                      )}
                      <Folder
                        className="h-3.5 w-3.5 flex-shrink-0"
                        style={{ color: category.color || undefined }}
                      />
                      <span className="flex-1 text-xs font-medium truncate">
                        {category.name}
                      </span>
                      {category.unreadCount > 0 && (
                        <Badge
                          count={category.unreadCount}
                          size="small"
                          className="bg-primary text-xs"
                          style={{ minWidth: 18, height: 18, lineHeight: '18px' }}
                        />
                      )}
                    </button>

                    {isOpen && hasFeeds && category.feeds && (
                      <div className="ml-5 mt-0.5 space-y-0.5">
                        {category.feeds.map((feed) => (
                          <Link
                            key={feed.id}
                            href={`/?feed=${feed.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
                          >
                            {feed.iconUrl && (
                              <img src={feed.iconUrl} alt="" className="w-3.5 h-3.5 rounded-sm flex-shrink-0" />
                            )}
                            <span className="flex-1 truncate">{feed.title}</span>
                            {feed.unreadCount && feed.unreadCount > 0 && (
                              <Badge
                                count={feed.unreadCount}
                                size="small"
                                className="bg-muted-foreground/20 text-muted-foreground text-xs"
                                style={{ minWidth: 16, height: 16, lineHeight: '16px' }}
                              />
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              订阅源
            </span>
            <Button
              type="text"
              size="small"
              icon={<Plus className="h-3 w-3" />}
              className="h-6 w-6 p-0"
              title="管理订阅源"
              onClick={() => {
                window.location.href = '/feeds/manage';
              }}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <Skeleton.Input key={i} active size="small" className="w-full" />
              ))}
            </div>
          ) : (
            <nav className="space-y-0.5">
              {feeds?.items.map((feed) => (
                <Link
                  key={feed.id}
                  href={`/?feed=${feed.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/30 transition-colors"
                >
                  {feed.iconUrl ? (
                    <img src={feed.iconUrl} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
                  ) : (
                    <Rss className="h-3.5 w-3.5 flex-shrink-0 text-primary/50" />
                  )}
                  <span className="flex-1 truncate text-foreground">{feed.title}</span>
                  {feed._count?.entries && feed._count.entries > 0 && (
                    <Badge
                      count={feed._count.entries}
                      size="small"
                      className="bg-primary text-xs"
                      style={{ minWidth: 16, height: 16, lineHeight: '16px' }}
                    />
                  )}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>

      <Modal
        title="新建分组"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateCategory}
        okText="创建"
        cancelText="取消"
        confirmLoading={createCategory.isPending}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm text-muted-foreground">分组名称</div>
            <Input
              placeholder="输入分组名称"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <div className="mb-2 text-sm text-muted-foreground">分组颜色</div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border-2 border-border/60"
                style={{ backgroundColor: newCategoryColor }}
              />
              <Input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className="w-20 h-10"
              />
              <div className="flex gap-2">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-lg border-2 transition-all',
                      newCategoryColor === color ? 'border-primary scale-110' : 'border-border/60 hover:border-primary/50'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
