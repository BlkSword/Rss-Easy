'use client';

/**
 * 书签风格的文章卡片
 * 带有丰富的悬停动画和视觉效果
 */

import { useState } from 'react';
import { Clock, Star, ExternalLink, Bookmark, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntryCardProps {
  id: string;
  title: string;
  summary?: string | null;
  url: string;
  feedTitle: string;
  feedIconUrl?: string | null;
  publishedAt?: Date | null;
  isRead: boolean;
  isStarred: boolean;
  readingTime?: number | null;
  aiSummary?: string | null;
  aiCategory?: string | null;
  onClick?: () => void;
  onToggleStar?: (e: React.MouseEvent) => void;
  onToggleRead?: (e: React.MouseEvent) => void;
}

export function EntryCard({
  id,
  title,
  summary,
  url,
  feedTitle,
  feedIconUrl,
  publishedAt,
  isRead,
  isStarred,
  readingTime,
  aiSummary,
  aiCategory,
  onClick,
  onToggleStar,
  onToggleRead,
}: EntryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatTime = (date?: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    return '刚刚';
  };

  // 获取分类颜色
  const getCategoryColor = (category: string | null) => {
    if (!category) return 'bg-gray-500/10 text-gray-400';
    const colors: Record<string, string> = {
      'AI/机器学习': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      '前端开发': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      '后端开发': 'bg-green-500/10 text-green-400 border-green-500/20',
      '移动开发': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      '云计算/DevOps': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      '数据库': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      '网络安全': 'bg-red-500/10 text-red-400 border-red-500/20',
      '行业新闻': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      '技术趋势': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      '工具/资源': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm transition-all duration-500 ease-out',
        'hover:shadow-xl hover:shadow-primary/10 hover:border-primary/20',
        isRead
          ? 'border-border/40 opacity-65'
          : 'border-border/60 hover:bg-card/90',
        isHovered && 'scale-[1.01] -translate-y-0.5'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* 顶部装饰条 */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary/40 via-primary/60 to-primary/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative p-6">
        {/* 头部：feed图标和时间 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Feed图标 */}
            <div className="relative">
              {!imageError && feedIconUrl ? (
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg overflow-hidden ring-2 ring-transparent transition-all duration-300',
                    'group-hover:ring-primary/30 group-hover:scale-110'
                  )}
                >
                  <img
                    src={feedIconUrl}
                    alt={feedTitle}
                    className={cn(
                      'h-full w-full object-cover transition-transform duration-500',
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    )}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary transition-all duration-300',
                    'group-hover:scale-110 group-hover:from-primary/30 group-hover:to-primary/10'
                  )}
                >
                  <Bookmark className="h-4 w-4" />
                </div>
              )}

              {/* 加载动画 */}
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 animate-pulse rounded-lg bg-primary/10" />
              )}
            </div>

            {/* Feed名称 */}
            <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
              {feedTitle}
            </span>
          </div>

          {/* 时间和阅读时间 */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {readingTime && (
              <span className="flex items-center gap-1 transition-colors group-hover:text-foreground">
                <Clock className="h-3.5 w-3.5" />
                {Math.ceil(readingTime / 60)}分钟
              </span>
            )}
            <span className="transition-colors group-hover:text-foreground">
              {formatTime(publishedAt)}
            </span>
          </div>
        </div>

        {/* AI分类标签 */}
        {aiCategory && (
          <div className="mb-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300',
                'hover:scale-105',
                getCategoryColor(aiCategory)
              )}
            >
              <Sparkles className="h-3 w-3" />
              {aiCategory}
            </span>
          </div>
        )}

        {/* 标题 */}
        <h3
          className={cn(
            'mb-3 text-lg font-semibold leading-tight transition-all duration-300',
            'group-hover:text-primary',
            isRead ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {title}
        </h3>

        {/* 摘要 */}
        {(summary || aiSummary) && (
          <p
            className={cn(
              'mb-4 line-clamp-2 text-sm text-muted-foreground transition-all duration-300',
              'group-hover:text-foreground/80'
            )}
          >
            {aiSummary || summary}
          </p>
        )}

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between">
          {/* 外部链接按钮 */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-all duration-300',
              'hover:text-primary hover:gap-2'
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            原文链接
          </a>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {onToggleRead && (
              <button
                onClick={onToggleRead}
                className={cn(
                  'rounded-lg p-2 transition-all duration-300',
                  'hover:bg-primary/10 hover:text-primary',
                  isRead && 'text-muted-foreground'
                )}
              >
                <Bookmark
                  className={cn(
                    'h-4 w-4 transition-all duration-300',
                    isRead && 'fill-current'
                  )}
                />
              </button>
            )}
            {onToggleStar && (
              <button
                onClick={onToggleStar}
                className={cn(
                  'rounded-lg p-2 transition-all duration-300',
                  'hover:bg-yellow-500/10 hover:text-yellow-500',
                  isStarred && 'text-yellow-500'
                )}
              >
                <Star
                  className={cn(
                    'h-4 w-4 transition-all duration-300',
                    isStarred && 'fill-current scale-110'
                  )}
                />
              </button>
            )}
          </div>
        </div>

        {/* AI摘要指示器 */}
        {aiSummary && (
          <div className="absolute right-2 top-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary',
                'animate-pulse shadow-lg shadow-primary/20'
              )}
              title="AI摘要已生成"
            >
              <Sparkles className="h-3 w-3" />
            </div>
          </div>
        )}
      </div>

      {/* 悬停时的流光效果 */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </div>
  );
}

/**
 * 书签网格布局
 */
export function EntryCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * 列表布局
 */
export function EntryCardList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}
