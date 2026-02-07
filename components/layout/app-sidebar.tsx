'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import {
  Rss,
  Folder,
  Plus,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X,
  Inbox,
  Star,
  Archive,
  Clock,
  Settings,
  Sparkles,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { SidebarSkeleton } from '@/components/ui/skeleton';
import { useUserPreferences } from '@/hooks/use-local-storage';

export interface AppSidebarProps {
  collapsed?: boolean;
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const pathname = usePathname();
  const { addToast } = useToast();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const { sidebarCollapsed } = useUserPreferences();

  const isCollapsed = collapsed || sidebarCollapsed;

  const { data: categories, isLoading: categoriesLoading } =
    trpc.categories.list.useQuery();
  const { data: feeds, isLoading: feedsLoading } = trpc.feeds.list.useQuery({
    limit: 100,
  });
  const { data: stats } = trpc.feeds.globalStats.useQuery();

  // 获取 tRPC utils 用于缓存操作
  const utils = trpc.useUtils();

  const createCategory = trpc.categories.add.useMutation({
    onSuccess: async () => {
      addToast({ type: 'success', title: '分组创建成功' });
      setNewCategoryName('');
      setIsCreateModalOpen(false);
      // 刷新分组列表
      await utils.categories.list.invalidate();
    },
    onError: (error) => {
      addToast({ type: 'error', title: '创建失败', message: error.message });
    },
  });

  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: async () => {
      addToast({ type: 'success', title: '分组更新成功' });
      setEditingCategoryId(null);
      setNewCategoryName('');
      setIsEditModalOpen(false);
      // 刷新分组列表
      await utils.categories.list.invalidate();
    },
    onError: (error) => {
      addToast({ type: 'error', title: '更新失败', message: error.message });
    },
  });

  const deleteCategory = trpc.categories.delete.useMutation({
    onSuccess: async () => {
      addToast({ type: 'success', title: '分组已删除' });
      // 刷新分组列表
      await utils.categories.list.invalidate();
    },
    onError: (error) => {
      addToast({ type: 'error', title: '删除失败', message: error.message });
    },
  });

  const toggleCategory = useCallback((categoryId: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      addToast({ type: 'warning', title: '请输入分组名称' });
      return;
    }
    await createCategory.mutateAsync({ name: newCategoryName });
  };

  const handleEditCategory = (categoryId: string, categoryName: string) => {
    setEditingCategoryId(categoryId);
    setNewCategoryName(categoryName);
    setIsEditModalOpen(true);
  };

  const handleUpdateCategory = async () => {
    if (!newCategoryName.trim()) {
      addToast({ type: 'warning', title: '请输入分组名称' });
      return;
    }
    if (!editingCategoryId) return;
    await updateCategory.mutateAsync({
      id: editingCategoryId,
      name: newCategoryName,
    });
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`确定要删除分组 "${categoryName}" 吗？此操作不会删除订阅源，只会取消关联。`)) {
      return;
    }
    await deleteCategory.mutateAsync({ id: categoryId });
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const navItems = [
    { icon: Inbox, label: '全部文章', href: '/', count: stats?.unreadCount },
    { icon: Clock, label: '未读', href: '/unread', count: stats?.unreadCount },
    { icon: Star, label: '星标', href: '/starred' },
    { icon: Archive, label: '归档', href: '/archive' },
    { icon: Sparkles, label: 'AI 报告', href: '/reports' },
  ];

  if (isCollapsed) {
    return (
      <aside className="h-full w-16 bg-muted/20 border-r border-border/60 flex flex-col py-4 gap-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => (
          <Tooltip key={item.href} content={item.label} position="right">
            <Link
              href={item.href}
              className={cn(
                'flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all duration-250 relative group',
                isActive(item.href)
                  ? 'bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className={cn(
                'h-5 w-5 transition-transform duration-200',
                isActive(item.href) ? 'scale-110' : 'group-hover:scale-110'
              )} />
              {item.count ? (
                <Badge
                  variant="primary"
                  size="sm"
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[10px]"
                >
                  {item.count > 99 ? '99+' : item.count}
                </Badge>
              ) : null}
            </Link>
          </Tooltip>
        ))}
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto scrollbar-hide">
      <div className="p-4 space-y-6">
        {/* 主导航 */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-item flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-250 group relative overflow-hidden',
                isActive(item.href)
                  ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary font-medium'
                  : 'text-foreground hover:bg-muted/60'
              )}
            >
              {/* 背景光晕效果 */}
              <span className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                !isActive(item.href) && 'group-hover:opacity-100'
              )} />
              <item.icon className={cn(
                'relative h-[18px] w-[18px] transition-all duration-200',
                isActive(item.href) ? 'scale-110' : 'group-hover:scale-110'
              )} />
              <span className="relative flex-1 text-sm">{item.label}</span>
              {item.count ? (
                <Badge variant="primary" size="sm" className="relative">
                  {item.count}
                </Badge>
              ) : null}
              {/* 选中指示器 */}
              {isActive(item.href) && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>

        {/* 分组 */}
        <div>
          <div className="flex items-center justify-between mb-2 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              分组
            </span>
            <Tooltip content="新建分组">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>

          {categoriesLoading ? (
            <div className="space-y-2 px-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 bg-muted/60 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <nav className="space-y-0.5">
              {categories?.map((category) => {
                const isOpen = openCategories.has(category.id);
                const hasFeeds = category._count.feeds > 0;

                return (
                  <div key={category.id} className="group/category">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => hasFeeds && toggleCategory(category.id)}
                        disabled={!hasFeeds}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 rounded-xl transition-all duration-200 text-left relative overflow-hidden',
                          hasFeeds && 'hover:bg-muted/60 hover:translate-x-0.5',
                          !hasFeeds && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {hasFeeds ? (
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                              isOpen && 'rotate-90'
                            )}
                          />
                        ) : (
                          <span className="w-4" />
                        )}
                        <Folder
                          className="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover/category:scale-110"
                          style={{ color: category.color || undefined }}
                        />
                        <span className="flex-1 text-sm truncate">
                          {category.name}
                        </span>
                        {category.unreadCount > 0 && (
                          <Badge variant="primary" size="sm">
                            {category.unreadCount}
                          </Badge>
                        )}
                      </button>

                      {/* 编辑和删除按钮 - 悬停显示 */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/category:opacity-100 transition-opacity duration-200">
                        <Tooltip content="编辑分组">
                          <button
                            onClick={() => handleEditCategory(category.id, category.name)}
                            className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="删除分组">
                          <button
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* 分组的订阅源 */}
                    {isOpen && hasFeeds && category.feeds && (
                      <div className="ml-8 mt-0.5 space-y-0.5">
                        {category.feeds.map((feed) => (
                          <Link
                            key={feed.id}
                            href={`/?feed=${feed.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-200 hover:translate-x-0.5 group"
                          >
                            {feed.iconUrl ? (
                              <img
                                src={feed.iconUrl}
                                alt=""
                                className="w-4 h-4 rounded transition-transform duration-200 group-hover:scale-110"
                              />
                            ) : (
                              <Rss className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
                            )}
                            <span className="flex-1 truncate">{feed.title}</span>
                            {feed.unreadCount > 0 && (
                              <Badge size="sm">{feed.unreadCount}</Badge>
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

        {/* 订阅源 */}
        <div>
          <div className="flex items-center justify-between mb-2 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              订阅源
            </span>
            <Tooltip content="管理订阅源">
              <Link href="/feeds/manage">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </Tooltip>
          </div>

          {feedsLoading ? (
            <div className="space-y-2 px-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 bg-muted/60 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <nav className="space-y-0.5">
              {feeds?.items.slice(0, 10).map((feed) => (
                <Link
                  key={feed.id}
                  href={`/?feed=${feed.id}`}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-200 group relative overflow-hidden',
                    pathname === `/?feed=${feed.id}`
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary'
                      : 'text-foreground hover:bg-muted/60 hover:translate-x-0.5'
                  )}
                >
                  {/* 背景光晕效果 */}
                  <span className={cn(
                    'absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                    pathname !== `/?feed=${feed.id}` && 'group-hover:opacity-100'
                  )} />
                  {feed.iconUrl ? (
                    <img
                      src={feed.iconUrl}
                      alt=""
                      className="relative w-4 h-4 rounded flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    />
                  ) : (
                    <Rss className="relative h-4 w-4 text-primary/60 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  )}
                  <span className="relative flex-1 truncate">{feed.title}</span>
                  {feed._count?.entries > 0 && (
                    <Badge size="sm" className="relative">{feed._count.entries}</Badge>
                  )}
                </Link>
              ))}
              {(feeds?.items?.length ?? 0) > 10 && (
                <Link
                  href="/feeds/manage"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-200 hover:translate-x-0.5 group"
                >
                  <Plus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  <span>查看全部</span>
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>

      {/* 创建分组模态框 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="新建分组"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateCategory}
              isLoading={createCategory.isPending}
            >
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">分组名称</label>
            <input
              type="text"
              placeholder="输入分组名称"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              maxLength={50}
              className="w-full h-10 px-3 rounded-xl border-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
            />
          </div>
        </div>
      </Modal>

      {/* 编辑分组模态框 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCategoryId(null);
          setNewCategoryName('');
        }}
        title="编辑分组"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setIsEditModalOpen(false);
              setEditingCategoryId(null);
              setNewCategoryName('');
            }}>
              取消
            </Button>
            <Button
              onClick={handleUpdateCategory}
              isLoading={updateCategory.isPending}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">分组名称</label>
            <input
              type="text"
              placeholder="输入分组名称"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              maxLength={50}
              className="w-full h-10 px-3 rounded-xl border-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory()}
            />
          </div>
        </div>
      </Modal>
    </aside>
  );
}

export default AppSidebar;
