'use client';

/**
 * 文章预览面板组件 - 三栏布局右侧
 * 显示文章完整内容和操作
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, ExternalLink, Bookmark, Clock, Calendar, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button, Divider, Skeleton, Tag } from 'antd';
import { useToast } from '@/components/ui/toast';
import { RichContentRenderer } from '@/components/entries/rich-content-renderer';

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
  const { addToast } = useToast();
  const utils = trpc.useUtils();
  const [content, setContent] = useState('');
  const { data: entry, isLoading } = trpc.entries.byId.useQuery(
    { id: entryId || '' },
    { enabled: !!entryId }
  );
  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();

  // 乐观更新状态
  const [optimisticStarred, setOptimisticStarred] = useState<boolean | null>(null);
  const [optimisticRead, setOptimisticRead] = useState<boolean | null>(null);

  // 使用乐观值或原始值
  const displayIsStarred = optimisticStarred ?? entry?.isStarred ?? false;
  const displayIsRead = optimisticRead ?? entry?.isRead ?? false;

  useEffect(() => {
    if (entry) {
      // 重置乐观状态，使用新数据
      setOptimisticStarred(null);
      setOptimisticRead(null);
      // 这里可以添加内容解析逻辑
      setContent(entry.summary || entry.content || '');
    }
  }, [entry]);

  const handleToggleStar = async () => {
    if (!entry) return;

    const newStarredState = !displayIsStarred;

    // 立即更新UI（乐观更新）
    setOptimisticStarred(newStarredState);

    try {
      await toggleStar.mutateAsync({ entryId: entry.id });
      addToast({
        type: 'success',
        title: newStarredState ? '已添加星标' : '已取消星标',
      });
    } catch {
      // 出错时回滚
      setOptimisticStarred(null);
      addToast({ type: 'error', title: '操作失败' });
    }
  };

  const handleToggleRead = async () => {
    if (!entry) return;

    const newReadState = !displayIsRead;

    // 立即更新UI（乐观更新）
    setOptimisticRead(newReadState);

    try {
      await toggleRead.mutateAsync({ entryId: entry.id });
      addToast({
        type: 'success',
        title: newReadState ? '已标记为已读' : '已标记为未读',
      });
    } catch {
      // 出错时回滚
      setOptimisticRead(null);
      addToast({ type: 'error', title: '操作失败' });
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
                className={cn('h-4 w-4 transition-colors', displayIsRead && 'fill-current')}
              />
            }
            onClick={handleToggleRead}
            title={displayIsRead ? '标记为未读' : '标记为已读'}
            size="small"
          />
          <Button
            type="text"
            icon={<Star className={cn('h-4 w-4 transition-colors', displayIsStarred && 'fill-yellow-500 text-yellow-500')} />}
            onClick={handleToggleStar}
            title={displayIsStarred ? '取消星标' : '添加星标'}
            size="small"
          />
          <Divider orientation="vertical" className="h-6 mx-1" />
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

          {/* 文章正文 */}
          <RichContentRenderer html={content} />

          {/* 查看完整原文链接 */}
          <div className="mt-12 pt-8 border-t border-border/60">
            <Link
              href={`/entries/${entry.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/10 group"
            >
              <span className="font-medium group-hover:underline">查看完整原文</span>
              <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
