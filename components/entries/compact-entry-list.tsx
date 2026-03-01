'use client';

/**
 * 紧凑型文章列表组件 - 主流RSS阅读器风格
 * 高密度信息展示，适合三栏布局
 *
 * 性能优化：
 * - 使用 memo 避免不必要的重渲染
 * - 使用 useCallback 缓存事件处理函数
 * - 使用 useMemo 缓存计算结果
 */

import { useState, memo, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Star, ExternalLink, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';

interface CompactEntryProps {
  id: string;
  title: string;
  url: string;
  feedTitle: string;
  feedIconUrl?: string | null;
  publishedAt?: Date | null;
  isRead: boolean;
  isStarred: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

/** 时间格式化函数（提取到组件外部避免重复创建） */
const formatTime = (date?: Date | null): string => {
  if (!date) return '';
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes > 0) return `${minutes}m`;
  return '刚刚';
};

/** 使用 memo 优化 CompactEntryItem 组件 */
export const CompactEntryItem = memo(function CompactEntryItem({
  id,
  title,
  url,
  feedTitle,
  feedIconUrl,
  publishedAt,
  isRead,
  isStarred,
  isActive = false,
  onClick,
}: CompactEntryProps) {
  const { addToast } = useToast();
  const [imageError, setImageError] = useState(false);
  // 乐观更新状态
  const [optimisticStarred, setOptimisticStarred] = useState<boolean | null>(null);
  const [optimisticRead, setOptimisticRead] = useState<boolean | null>(null);

  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();

  // 使用乐观值或原始值
  const displayIsStarred = optimisticStarred ?? isStarred;
  const displayIsRead = optimisticRead ?? isRead;

  // 使用 useMemo 缓存格式化后的时间
  const formattedTime = useMemo(() => formatTime(publishedAt), [publishedAt]);

  // 使用 useCallback 缓存事件处理函数
  const handleToggleStar = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStarredState = !displayIsStarred;

    // 立即更新UI（乐观更新）
    setOptimisticStarred(newStarredState);

    try {
      await toggleStar.mutateAsync({ entryId: id });
      addToast({
        type: 'success',
        title: newStarredState ? '已添加星标' : '已取消星标',
      });
    } catch {
      // 出错时回滚
      setOptimisticStarred(null);
      addToast({ type: 'error', title: '操作失败' });
    }
  }, [displayIsStarred, toggleStar, id, addToast]);

  const handleToggleRead = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newReadState = !displayIsRead;

    // 立即更新UI（乐观更新）
    setOptimisticRead(newReadState);

    try {
      await toggleRead.mutateAsync({ entryId: id });
      addToast({
        type: 'success',
        title: newReadState ? '已标记为已读' : '已标记为未读',
      });
    } catch {
      // 出错时回滚
      setOptimisticRead(null);
      addToast({ type: 'error', title: '操作失败' });
    }
  }, [displayIsRead, toggleRead, id, addToast]);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/40',
        'hover:bg-muted/50',
        isActive && 'bg-primary/10 border-l-2 border-l-primary',
        !isActive && 'border-l-2 border-l-transparent'
      )}
      onClick={handleClick}
    >
      {/* Feed图标 */}
      <div className="flex-shrink-0 mt-0.5">
        {!imageError && feedIconUrl ? (
          <img
            src={feedIconUrl}
            alt={feedTitle}
            className="w-5 h-5 rounded-sm object-cover"
            onError={handleImageError}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <Bookmark className="h-3 w-3 text-primary/60" />
          </div>
        )}
      </div>

      {/* 文章信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <h4
              className={cn(
                'text-sm leading-snug line-clamp-2 transition-colors',
                displayIsRead ? 'text-muted-foreground font-normal' : 'text-foreground font-semibold',
                !displayIsRead && 'group-hover:text-primary'
              )}
            >
              {title}
            </h4>

            {/* Feed名称和时间 */}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="truncate max-w-[120px]">{feedTitle}</span>
              <span>·</span>
              <span>{formattedTime}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleToggleRead}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title={displayIsRead ? '标记为未读' : '标记为已读'}
            >
              <Bookmark
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors',
                  displayIsRead && 'fill-current'
                )}
              />
            </button>
            <button
              onClick={handleToggleStar}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title={displayIsStarred ? '取消星标' : '添加星标'}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  displayIsStarred ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'
                )}
              />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="在新窗口打开"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          </div>
        </div>
      </div>

      {/* 未读指示器 */}
      {!displayIsRead && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键属性变化时重渲染
  return (
    prevProps.id === nextProps.id &&
    prevProps.isRead === nextProps.isRead &&
    prevProps.isStarred === nextProps.isStarred &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.title === nextProps.title
  );
});

/**
 * 紧凑型文章列表容器
 */
interface CompactEntryListProps {
  children: React.ReactNode;
  className?: string;
}

export function CompactEntryList({ children, className }: CompactEntryListProps) {
  return (
    <div className={cn('bg-card/50 backdrop-blur-sm rounded-lg border border-border/60 overflow-hidden', className)}>
      {children}
    </div>
  );
}

/**
 * 空状态
 */
export function CompactEntryEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-center">
      <div>
        <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
