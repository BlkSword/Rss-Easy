/**
 * 订阅源管理页面
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Edit,
  Rss,
  FolderOpen,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export default function FeedsManagePage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');

  const { data: feedsData, isLoading } = trpc.feeds.list.useQuery({
    search: search || undefined,
  });
  const { data: categories } = trpc.categories.list.useQuery();

  const addFeed = trpc.feeds.add.useMutation();
  const bulkAction = trpc.feeds.bulkAction.useMutation();

  const feeds = feedsData?.items || [];

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl.trim()) return;

    try {
      await addFeed.mutateAsync({ url: newFeedUrl });
      setNewFeedUrl('');
      setShowAddForm(false);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '添加失败');
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete' | 'refresh') => {
    if (selectedIds.size === 0) return;

    const confirmMsg = {
      activate: '确定要启用这些订阅源吗？',
      deactivate: '确定要禁用这些订阅源吗？',
      delete: '确定要删除这些订阅源吗？此操作不可恢复。',
      refresh: '确定要刷新这些订阅源吗？',
    }[action];

    if (!confirm(confirmMsg)) return;

    try {
      await bulkAction.mutateAsync({
        feedIds: Array.from(selectedIds),
        action,
      });
      setSelectedIds(new Set());
      window.location.reload();
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === feeds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(feeds.map((f) => f.id)));
    }
  };

  return (
    <div className="container py-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">订阅源管理</h1>
          <p className="text-muted-foreground">管理您的RSS订阅源</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          添加订阅源
        </button>
      </div>

      {/* 添加订阅源表单 */}
      {showAddForm && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">添加新订阅源</h3>
          <form onSubmit={handleAddFeed} className="flex gap-3">
            <input
              type="url"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              placeholder="输入RSS订阅地址 (https://...)"
              className="flex-1 px-4 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <button
              type="submit"
              disabled={addFeed.isPending}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {addFeed.isPending ? '添加中...' : '添加'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              取消
            </button>
          </form>
          <div className="mt-3 text-sm text-muted-foreground">
            支持格式: RSS、Atom、RDF
          </div>
        </div>
      )}

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-background border rounded-lg p-3 mb-6 flex items-center gap-2 shadow-sm">
          <input
            type="checkbox"
            checked={selectedIds.size === feeds.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-muted-foreground">
            已选择 {selectedIds.size} / {feeds.length} 个订阅源
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBulkAction('refresh')}
            className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </button>
          <button
            onClick={() => handleBulkAction('activate')}
            className="px-3 py-1.5 text-sm bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-md transition-colors"
          >
            启用
          </button>
          <button
            onClick={() => handleBulkAction('deactivate')}
            className="px-3 py-1.5 text-sm bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 rounded-md transition-colors"
          >
            禁用
          </button>
          <button
            onClick={() => handleBulkAction('delete')}
            className="px-3 py-1.5 text-sm bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-md transition-colors"
          >
            删除
          </button>
        </div>
      )}

      {/* 搜索框 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索订阅源..."
            className="w-full pl-10 pr-4 py-2 bg-card border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* 订阅源列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-12">
          <Rss className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {search ? '没有找到匹配的订阅源' : '还没有订阅源'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {search ? '尝试其他关键词' : '添加您的第一个RSS订阅源开始使用'}
          </p>
          {!search && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              添加订阅源
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {/* 表头 */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 font-medium text-sm">
            <div className="col-span-1">
              <input
                type="checkbox"
                checked={selectedIds.size === feeds.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded"
              />
            </div>
            <div className="col-span-5">订阅源</div>
            <div className="col-span-2">分类</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2">统计</div>
          </div>

          {/* 列表项 */}
          {feeds.map((feed) => {
            const category = categories?.find((c) => c.id === feed.categoryId);

            return (
              <div
                key={feed.id}
                className={cn(
                  'grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors',
                  !feed.isActive && 'opacity-60'
                )}
              >
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(feed.id)}
                    onChange={() => toggleSelect(feed.id)}
                    className="w-4 h-4 rounded"
                  />
                </div>

                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  {feed.iconUrl ? (
                    <img src={feed.iconUrl} alt="" className="w-8 h-8 rounded" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                      <Rss className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <Link
                    href={`/feeds/${feed.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="font-medium truncate hover:text-primary transition-colors">
                      {feed.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {feed.feedUrl}
                    </div>
                  </Link>
                </div>

                <div className="col-span-2">
                  {category ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs" style={{ backgroundColor: `${category.color || '#6b7280'}20`, color: category.color || undefined }}>
                      <FolderOpen className="h-3 w-3" />
                      <span className="truncate max-w-[100px]">{category.name}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">未分类</span>
                  )}
                </div>

                <div className="col-span-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                    feed.isActive
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-gray-500/10 text-gray-600'
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {feed.isActive ? '启用' : '禁用'}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <span>{feed.unreadCount} 未读</span>
                  </div>
                  <Link
                    href={`/feeds/${feed.id}`}
                    className="p-1 hover:bg-secondary rounded transition-colors"
                  >
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
