/**
 * 文章列表组件
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Star,
  StarOff,
  Archive,
  ArchiveRestore,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface EntryListProps {
  filters?: {
    unreadOnly?: boolean;
    starredOnly?: boolean;
    archivedOnly?: boolean;
    feedId?: string;
    categoryId?: string;
    search?: string;
  };
}

export function EntryList({ filters = {} }: EntryListProps) {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = trpc.entries.list.useQuery({
    page,
    limit: 20,
    ...filters,
  });

  const markAsRead = trpc.entries.markAsRead.useMutation();
  const markAsStarred = trpc.entries.markAsStarred.useMutation();
  const bulkAction = trpc.entries.bulkAction.useMutation();

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

  const toggleStarred = async (entryId: string, currentState: boolean) => {
    await markAsStarred.mutateAsync({
      entryIds: [entryId],
      starred: !currentState,
    });
  };

  const toggleRead = async (entryId: string) => {
    await markAsRead.mutateAsync({
      entryIds: [entryId],
    });
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    await bulkAction.mutateAsync({
      entryIds: Array.from(selectedIds),
      action: action as any,
    });
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        加载失败: {error.message}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        暂无文章
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-background border rounded-lg p-3 flex items-center gap-2 shadow-sm">
          <span className="text-sm text-muted-foreground">
            已选择 {selectedIds.size} 篇文章
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBulkAction('markRead')}
            className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            标记已读
          </button>
          <button
            onClick={() => handleBulkAction('star')}
            className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            加星标
          </button>
          <button
            onClick={() => handleBulkAction('archive')}
            className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            归档
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary rounded-md transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 文章列表 */}
      {data.items.map((entry) => (
        <article
          key={entry.id}
          className={cn(
            'group p-4 rounded-lg border transition-all hover:shadow-md',
            !entry.isRead && 'bg-primary/5 border-primary/20',
            entry.isRead && 'bg-card'
          )}
        >
          <div className="flex gap-3">
            {/* 选择框 */}
            <input
              type="checkbox"
              checked={selectedIds.has(entry.id)}
              onChange={() => toggleSelect(entry.id)}
              className="mt-1 w-4 h-4 rounded border-gray-300"
            />

            <div className="flex-1 min-w-0">
              {/* 标题 */}
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/entries/${entry.id}`}
                  onClick={() => !entry.isRead && toggleRead(entry.id)}
                  className={cn(
                    'font-medium line-clamp-2 hover:text-primary transition-colors',
                    !entry.isRead && 'font-semibold'
                  )}
                >
                  {entry.title}
                </Link>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleStarred(entry.id, entry.isStarred)}
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                    title={entry.isStarred ? '取消星标' : '添加星标'}
                  >
                    {entry.isStarred ? (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                    title="在新窗口打开"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              </div>

              {/* 摘要 */}
              {entry.summary && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {entry.summary}
                </p>
              )}

              {/* 元信息 */}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                {/* 订阅源 */}
                <span className="flex items-center gap-1">
                  {entry.feed.iconUrl && (
                    <img src={entry.feed.iconUrl} alt="" className="w-4 h-4 rounded" />
                  )}
                  <span className="hover:text-primary transition-colors">
                    {entry.feed.title}
                  </span>
                </span>

                {/* 发布时间 */}
                <span>
                  {formatDistanceToNow(new Date(entry.publishedAt || entry.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>

                {/* AI 标签 */}
                {entry.aiCategory && (
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-full">
                    {entry.aiCategory}
                  </span>
                )}

                {/* 关键词 */}
                {entry.aiKeywords?.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full"
                  >
                    {keyword}
                  </span>
                ))}

                {/* 重要性评分 */}
                {entry.aiImportanceScore && entry.aiImportanceScore > 0.7 && (
                  <span className="px-2 py-0.5 bg-red-500/10 text-red-600 rounded-full">
                    重要
                  </span>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}

      {/* 分页 */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!data.pagination.hasPrev || bulkAction.isPending}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            上一页
          </button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {data.pagination.totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.pagination.hasNext || bulkAction.isPending}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
