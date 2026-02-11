/**
 * 文章列表组件 - 优化版
 * 支持虚拟滚动、无限加载、键盘导航
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Star,
  ExternalLink,
  Check,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trash2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { EntryListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText, Rss, Search } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/use-intersection-observer';
import { useReaderShortcuts } from '@/hooks/use-keyboard';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/animation/fade';

interface EntryListProps {
  filters?: {
    unreadOnly?: boolean;
    starredOnly?: boolean;
    archivedOnly?: boolean;
    feedId?: string;
    categoryId?: string;
    search?: string;
  };
  onSelect?: (entryId: string) => void;
  selectedId?: string | null;
  variant?: 'compact' | 'card';
}

export function EntryList({
  filters = {},
  onSelect,
  selectedId,
  variant = 'compact',
}: EntryListProps) {
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取 tRPC utils 用于缓存操作
  const utils = trpc.useUtils();

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.entries.infiniteList.useInfiniteQuery(
      { ...filters, limit: 20 },
      {
        getNextPageParam: (lastPage) =>
          lastPage.pagination.hasNext ? lastPage.pagination.nextCursor : undefined,
      }
    );

  const entries = data?.pages.flatMap((page) => page.items) || [];

  const { loadMoreRef } = useInfiniteScroll(
    () => fetchNextPage(),
    hasNextPage || false,
    isFetchingNextPage
  );

  const markAsRead = trpc.entries.markAsRead.useMutation({
    onMutate: async (vars) => {
      // 取消正在进行的查询
      await Promise.all([
        utils.entries.infiniteList.cancel({ ...filters, limit: 20 }),
        utils.entries.list.cancel({ ...filters, limit: 50 }),
        utils.feeds.globalStats.cancel(),
        utils.categories.list.cancel(),
        utils.feeds.list.cancel({ limit: 100 }),
      ]);

      // 保存当前数据以便回滚
      const previousInfiniteData = utils.entries.infiniteList.getData({ ...filters, limit: 20 });
      const previousListData = utils.entries.list.getData({ ...filters, limit: 50 });
      const previousGlobalStats = utils.feeds.globalStats.getData();
      const previousCategories = utils.categories.list.getData();
      const previousFeeds = utils.feeds.list.getData({ limit: 100 });

      // 乐观更新：立即更新 infiniteList 缓存中的数据
      utils.entries.infiniteList.setData({ ...filters, limit: 20 }, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) =>
              vars.entryIds.includes(item.id)
                ? { ...item, isRead: true }
                : item
            ),
          })),
        };
      });

      // 乐观更新：立即更新 list 缓存中的数据
      utils.entries.list.setData({ ...filters, limit: 50 }, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          items: oldData.items.map((item: any) =>
            vars.entryIds.includes(item.id)
              ? { ...item, isRead: true }
              : item
          ),
        };
      });

      // 乐观更新：更新全局未读计数
      utils.feeds.globalStats.setData(undefined, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          unreadCount: Math.max(0, oldData.unreadCount - vars.entryIds.length),
        };
      });

      // 乐观更新：更新分类未读计数
      utils.categories.list.setData(undefined, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          categories: oldData.categories.map((category: any) => {
            // 计算该分类中被标记的未读文章数
            const affectedCount = vars.entryIds.filter((id: string) => {
              const entry = entries.find(e => e.id === id);
              return entry?.feed?.categoryId === category.id;
            }).length;
            return {
              ...category,
              unreadCount: Math.max(0, category.unreadCount - affectedCount),
              feeds: category.feeds?.map((feed: any) => {
                const feedAffectedCount = vars.entryIds.filter((id: string) => {
                  const entry = entries.find(e => e.id === id);
                  return entry?.feedId === feed.id;
                }).length;
                return {
                  ...feed,
                  unreadCount: Math.max(0, feed.unreadCount - feedAffectedCount),
                };
              }),
            };
          }),
        };
      });

      // 乐观更新：更新订阅源列表中的未读计数
      utils.feeds.list.setData({ limit: 100 }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((feed: any) => {
            const affectedCount = vars.entryIds.filter((id: string) => {
              const entry = entries.find(e => e.id === id);
              return entry?.feedId === feed.id;
            }).length;
            return {
              ...feed,
              unreadCount: Math.max(0, (feed.unreadCount || 0) - affectedCount),
            };
          }),
        };
      });

      return { previousInfiniteData, previousListData, previousGlobalStats, previousCategories, previousFeeds };
    },
    onSuccess: async () => {
      // 重新验证查询以确保数据同步
      await Promise.all([
        utils.entries.infiniteList.invalidate({ ...filters, limit: 20 }),
        utils.entries.list.invalidate({ ...filters, limit: 50 }),
        utils.feeds.globalStats.invalidate(),
        utils.categories.list.invalidate(),
        utils.feeds.list.invalidate({ limit: 100 }),
      ]);
    },
    onError: (error, _vars, context) => {
      // 出错时回滚到之前的状态
      if (context?.previousInfiniteData) {
        utils.entries.infiniteList.setData({ ...filters, limit: 20 }, context.previousInfiniteData);
      }
      if (context?.previousListData) {
        utils.entries.list.setData({ ...filters, limit: 50 }, context.previousListData);
      }
      if (context?.previousGlobalStats) {
        utils.feeds.globalStats.setData(undefined, context.previousGlobalStats);
      }
      if (context?.previousCategories) {
        utils.categories.list.setData(undefined, context.previousCategories);
      }
      if (context?.previousFeeds) {
        utils.feeds.list.setData({ limit: 100 }, context.previousFeeds);
      }
      addToast({
        type: 'error',
        title: '操作失败',
        message: error.message,
      });
    },
  });

  const markAsStarred = trpc.entries.markAsStarred.useMutation({
    onMutate: async (vars) => {
      // 取消正在进行的查询
      await Promise.all([
        utils.entries.infiniteList.cancel({ ...filters, limit: 20 }),
        utils.entries.list.cancel({ ...filters, limit: 50 }),
      ]);

      // 保存当前数据以便回滚
      const previousInfiniteData = utils.entries.infiniteList.getData({ ...filters, limit: 20 });
      const previousListData = utils.entries.list.getData({ ...filters, limit: 50 });

      // 乐观更新：立即更新 infiniteList 缓存中的数据
      utils.entries.infiniteList.setData({ ...filters, limit: 20 }, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) =>
              vars.entryIds.includes(item.id)
                ? { ...item, isStarred: vars.starred }
                : item
            ),
          })),
        };
      });

      // 乐观更新：立即更新 list 缓存中的数据
      utils.entries.list.setData({ ...filters, limit: 50 }, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          items: oldData.items.map((item: any) =>
            vars.entryIds.includes(item.id)
              ? { ...item, isStarred: vars.starred }
              : item
          ),
        };
      });

      // 返回上下文以便在出错时回滚
      return { previousInfiniteData, previousListData };
    },
    onSuccess: async (_, vars) => {
      // 重新验证查询以确保数据同步
      await Promise.all([
        utils.entries.infiniteList.invalidate({ ...filters, limit: 20 }),
        utils.entries.list.invalidate({ ...filters, limit: 50 }),
      ]);
      addToast({
        type: 'success',
        title: vars.starred ? '已添加星标' : '已取消星标',
      });
    },
    onError: (error, vars, context) => {
      // 出错时回滚到之前的状态
      if (context?.previousInfiniteData) {
        utils.entries.infiniteList.setData({ ...filters, limit: 20 }, context.previousInfiniteData);
      }
      if (context?.previousListData) {
        utils.entries.list.setData({ ...filters, limit: 50 }, context.previousListData);
      }
      addToast({
        type: 'error',
        title: '操作失败',
        message: error.message,
      });
    },
  });

  const bulkAction = trpc.entries.bulkAction.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      addToast({ type: 'success', title: '批量操作成功' });
    },
  });

  // 键盘导航
  useReaderShortcuts({
    onNext: () => {
      const currentIndex = entries.findIndex((e) => e.id === selectedId);
      if (currentIndex < entries.length - 1) {
        onSelect?.(entries[currentIndex + 1].id);
      }
    },
    onPrevious: () => {
      const currentIndex = entries.findIndex((e) => e.id === selectedId);
      if (currentIndex > 0) {
        onSelect?.(entries[currentIndex - 1].id);
      }
    },
  });

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

  // 选择文章时自动标记为已读
  const handleSelect = useCallback((entryId: string) => {
    onSelect?.(entryId);
    // 查找该文章是否未读，如果是则标记为已读
    const entry = entries.find(e => e.id === entryId);
    if (entry && !entry.isRead) {
      markAsRead.mutate({ entryIds: [entryId] });
    }
  }, [onSelect, entries, markAsRead]);

  const handleToggleStar = async (entryId: string, isStarred: boolean) => {
    await markAsStarred.mutateAsync({ entryIds: [entryId], starred: !isStarred });
  };

  const handleMarkRead = async (entryId: string) => {
    await markAsRead.mutateAsync({ entryIds: [entryId] });
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    await bulkAction.mutateAsync({
      entryIds: Array.from(selectedIds),
      action: action as any,
    });
  };

  if (isLoading) {
    return <EntryListSkeleton count={8} />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">加载失败: {error.message}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          重试
        </Button>
      </div>
    );
  }

  if (entries.length === 0) {
    if (filters.search) {
      return (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="未找到相关文章"
          description={`没有找到与 "${filters.search}" 匹配的文章`}
          variant="card"
        />
      );
    }
    return (
      <EmptyState
        icon={<Rss className="h-10 w-10" />}
        title="还没有文章"
        description="订阅一些RSS源开始阅读"
        variant="card"
      />
    );
  }

  return (
    <PageTransition>
      <div ref={containerRef} className="h-full flex flex-col">
        {/* 批量操作栏 */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 frosted-glass rounded-xl p-3 flex items-center gap-2 animate-slideIn flex-shrink-0">
            <Badge variant="primary">已选择 {selectedIds.size}</Badge>
            <div className="flex-1" />
            <Tooltip content="标记已读" position="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('markRead')}
              >
                <Check className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="添加星标" position="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('star')}
              >
                <Star className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="归档" position="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('archive')}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              取消
            </Button>
          </div>
        )}

        {/* 文章列表 - 可滚动 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 -mx-1 px-1">
          {entries.map((entry, index) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              isSelected={selectedId === entry.id}
              isChecked={selectedIds.has(entry.id)}
              onSelect={() => handleSelect(entry.id)}
              onToggleCheck={() => toggleSelect(entry.id)}
              onToggleStar={() => handleToggleStar(entry.id, entry.isStarred)}
              onMarkRead={() => handleMarkRead(entry.id)}
              index={index}
            />
          ))}

          {/* 无限滚动触发器 */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center flex-shrink-0">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">加载更多...</span>
              </div>
            ) : hasNextPage ? (
              <div className="h-4" /> // 触发观察的最小高度
            ) : entries.length > 0 ? (
              <p className="text-xs text-muted-foreground">已加载全部内容</p>
            ) : null}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

/**
 * 单个文章项
 */
interface EntryItemProps {
  entry: any;
  isSelected?: boolean;
  isChecked?: boolean;
  onSelect?: () => void;
  onToggleCheck?: () => void;
  onToggleStar?: () => void;
  onMarkRead?: () => void;
  index: number;
}

function EntryItem({
  entry,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  onToggleStar,
  onMarkRead,
  index,
}: EntryItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer',
        isSelected
          ? 'bg-gradient-to-r from-primary/[0.06] to-transparent border-primary/40 shadow-sm'
          : 'bg-card border-border/40 hover:border-primary/25 hover:shadow-sm hover:-translate-y-0.5',
        !entry.isRead && 'border-l-4 border-l-primary'
      )}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
    >
      {/* 选择框 */}
      <div className="pt-0.5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck?.();
          }}
          className="w-4 h-4 rounded border-2 border-border/60 text-primary focus:ring-primary/20 focus:ring-2 transition-all duration-200 cursor-pointer hover:border-primary/40"
        />
      </div>

      {/* Feed 图标 */}
      <div className="flex-shrink-0 mt-0.5">
        {entry.feed.iconUrl ? (
          <img
            src={entry.feed.iconUrl}
            alt=""
            className="w-8 h-8 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-xs font-medium">
              {entry.feed.title?.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <h3
              className={cn(
                'text-sm leading-snug line-clamp-2 transition-all duration-200',
                !entry.isRead
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-muted-foreground',
                'group-hover:text-primary group-hover:translate-x-0.5'
              )}
            >
              {entry.title}
            </h3>

            {/* 元信息 */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium">{entry.feed.title}</span>
              <span>·</span>
              <span>
                {formatDistanceToNow(new Date(entry.publishedAt || entry.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </span>
              {entry.aiCategory && (
                <>
                  <span>·</span>
                  <Badge variant="info" size="sm">
                    {entry.aiCategory}
                  </Badge>
                </>
              )}
              {/* 情感倾向 */}
              {entry.aiSentiment && (
                <>
                  <span>·</span>
                  <Badge
                    variant="default"
                    size="sm"
                    className={cn(
                      entry.aiSentiment === 'positive' && "bg-green-500/10 text-green-500 border-green-500/20",
                      entry.aiSentiment === 'negative' && "bg-red-500/10 text-red-500 border-red-500/20",
                      entry.aiSentiment === 'neutral' && "bg-gray-500/10 text-gray-500 border-gray-500/20"
                    )}
                  >
                    {entry.aiSentiment === 'positive' && '积极'}
                    {entry.aiSentiment === 'negative' && '消极'}
                    {entry.aiSentiment === 'neutral' && '中性'}
                  </Badge>
                </>
              )}
              {/* 重要性评分 */}
              {entry.aiImportanceScore > 0 && (
                <>
                  <span>·</span>
                  <span className={cn(
                    "font-medium",
                    entry.aiImportanceScore >= 0.8 ? "text-orange-500" :
                    entry.aiImportanceScore >= 0.5 ? "text-blue-500" :
                    "text-gray-500"
                  )}>
                    {entry.aiImportanceScore >= 0.8 && '⭐⭐⭐' }
                    {entry.aiImportanceScore >= 0.5 && entry.aiImportanceScore < 0.8 && '⭐⭐'}
                    {entry.aiImportanceScore < 0.5 && '⭐'}
                  </span>
                </>
              )}
            </div>

            {/* 摘要 */}
            {(entry.aiSummary || entry.summary) && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {entry.aiSummary || entry.summary}
              </p>
            )}

            {/* AI 标签 */}
            {entry.aiKeywords && entry.aiKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {entry.aiKeywords.slice(0, 3).map((keyword: string) => (
                  <Badge key={keyword} variant="secondary" size="sm">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div
            className={cn(
              'flex flex-col gap-1 opacity-0 transition-all duration-200',
              (isHovered || isSelected) && 'opacity-100'
            )}
          >
            <Tooltip content={entry.isRead ? '标记未读' : '标记已读'} position="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead?.();
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95',
                  entry.isRead
                    ? 'hover:bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground hover:text-primary'
                )}
              >
                <Check className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip content={entry.isStarred ? '取消星标' : '添加星标'} position="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar?.();
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95',
                  entry.isStarred
                    ? 'hover:bg-yellow-500/10'
                    : 'hover:bg-yellow-500/10 text-muted-foreground'
                )}
              >
                <Star
                  className={cn(
                    'h-4 w-4 transition-colors',
                    entry.isStarred
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'hover:text-yellow-500'
                  )}
                />
              </button>
            </Tooltip>
            <Tooltip content="原文链接" position="bottom">
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* 未读指示器 */}
      {!entry.isRead && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full" />
      )}
    </article>
  );
}

export default EntryList;
