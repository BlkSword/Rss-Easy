'use client';

/**
 * 紧凑型文章列表组件 - 主流RSS阅读器风格
 * 高密度信息展示，适合三栏布局
 */

import { useState } from 'react';
import Link from 'next/link';
import { Star, ExternalLink, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { message } from 'antd';

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

export function CompactEntryItem({
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
  const [imageError, setImageError] = useState(false);
  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();

  const formatTime = (date?: Date | null) => {
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

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleStar.mutateAsync({ entryId: id });
    } catch {
      message.error('操作失败');
    }
  };

  const handleToggleRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleRead.mutateAsync({ entryId: id });
    } catch {
      message.error('操作失败');
    }
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/40',
        'hover:bg-muted/50',
        isActive && 'bg-primary/10 border-l-2 border-l-primary',
        !isActive && 'border-l-2 border-l-transparent'
      )}
      onClick={onClick}
    >
      {/* Feed图标 */}
      <div className="flex-shrink-0 mt-0.5">
        {!imageError && feedIconUrl ? (
          <img
            src={feedIconUrl}
            alt={feedTitle}
            className="w-5 h-5 rounded-sm object-cover"
            onError={() => setImageError(true)}
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
                isRead ? 'text-muted-foreground font-normal' : 'text-foreground font-semibold',
                !isRead && 'group-hover:text-primary'
              )}
            >
              {title}
            </h4>

            {/* Feed名称和时间 */}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="truncate max-w-[120px]">{feedTitle}</span>
              <span>·</span>
              <span>{formatTime(publishedAt)}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleToggleRead}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title={isRead ? '标记为未读' : '标记为已读'}
            >
              <Bookmark
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors',
                  isRead && 'fill-current'
                )}
              />
            </button>
            <button
              onClick={handleToggleStar}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title={isStarred ? '取消星标' : '添加星标'}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  isStarred ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'
                )}
              />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="在新窗口打开"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          </div>
        </div>
      </div>

      {/* 未读指示器 */}
      {!isRead && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}

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
