'use client';

/**
 * 文章预览面板组件 - 三栏布局右侧
 * 显示文章完整内容和操作
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, ExternalLink, Bookmark, Clock, Calendar, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button, Divider, Skeleton, Tag } from 'antd';
import { Sparkles } from 'lucide-react';

interface ArticlePreviewPanelProps {
  entryId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ArticlePreviewPanel({
  entryId,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: ArticlePreviewPanelProps) {
  const [content, setContent] = useState('');
  const { data: entry, isLoading } = trpc.entries.byId.useQuery(
    { id: entryId || '' },
    { enabled: !!entryId }
  );
  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();
  const [isStarred, setIsStarred] = useState(false);

  useEffect(() => {
    if (entry) {
      setIsStarred(entry.isStarred);
      // 这里可以添加内容解析逻辑
      setContent(entry.summary || entry.content || '');
    }
  }, [entry]);

  const handleToggleStar = async () => {
    if (!entry) return;
    try {
      await toggleStar.mutateAsync({ entryId: entry.id });
      setIsStarred(!isStarred);
    } catch {
      // Error handling
    }
  };

  const handleToggleRead = async () => {
    if (!entry) return;
    try {
      await toggleRead.mutateAsync({ entryId: entry.id });
    } catch {
      // Error handling
    }
  };

  const formatDate = (date?: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatReadingTime = (minutes?: number | null) => {
    if (!minutes) return '';
    const mins = Math.ceil(minutes / 60);
    return mins > 0 ? `${mins} 分钟阅读` : '';
  };

  if (!entryId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bookmark className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-sm">选择一篇文章开始阅读</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full p-6 space-y-6 overflow-y-auto">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>文章未找到</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-sm">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background/50">
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={onPrevious}
            disabled={!hasPrevious}
            size="small"
            title="上一篇"
          />
          <Button
            type="text"
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={onNext}
            disabled={!hasNext}
            size="small"
            title="下一篇"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={
              <Bookmark
                className={cn('h-4 w-4 transition-colors', entry.isRead && 'fill-current')}
              />
            }
            onClick={handleToggleRead}
            title={entry.isRead ? '标记为未读' : '标记为已读'}
            size="small"
          />
          <Button
            type="text"
            icon={<Star className={cn('h-4 w-4 transition-colors', isStarred && 'fill-yellow-500 text-yellow-500')} />}
            onClick={handleToggleStar}
            title={isStarred ? '取消星标' : '添加星标'}
            size="small"
          />
          <Divider type="vertical" className="h-6 mx-1" />
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              'bg-primary/10 text-primary hover:bg-primary/20'
            )}
          >
            <ExternalLink className="h-4 w-4" />
            原文链接
          </a>
        </div>
      </div>

      {/* 文章内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* 文章头部 */}
          <div className="mb-8">
            {/* Feed信息 */}
            <div className="flex items-center gap-3 mb-4">
              {entry.feed.iconUrl && (
                <img
                  src={entry.feed.iconUrl}
                  alt={entry.feed.title}
                  className="w-6 h-6 rounded-sm"
                />
              )}
              <Link
                href={`/feeds/${entry.feed.id}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {entry.feed.title}
              </Link>
            </div>

            {/* 标题 */}
            <h1 className="text-2xl font-bold leading-tight mb-4">
              <Link
                href={entry.url}
                target="_blank"
                className="hover:text-primary transition-colors"
              >
                {entry.title}
              </Link>
            </h1>

            {/* 元信息 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(entry.publishedAt)}</span>
              </div>
              {entry.readingTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{formatReadingTime(entry.readingTime)}</span>
                </div>
              )}
            </div>

            {/* AI分类标签 */}
            {entry.aiCategory && (
              <div className="mt-4">
                <Tag
                  icon={<Sparkles className="h-3 w-3" />}
                  className="rounded-full border-primary/30 bg-primary/5 text-primary/80"
                >
                  {entry.aiCategory}
                </Tag>
              </div>
            )}
          </div>

          <Divider className="my-6 bg-border/40" />

          {/* AI摘要 */}
          {entry.aiSummary && (
            <div className="mb-8 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/10">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                <span>AI 摘要</span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {entry.aiSummary}
              </p>
            </div>
          )}

          {/* 文章正文 */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div
              className="text-foreground/90 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>

          {/* 原文链接 */}
          <div className="mt-12 pt-8 border-t border-border/60">
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              查看完整原文
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
