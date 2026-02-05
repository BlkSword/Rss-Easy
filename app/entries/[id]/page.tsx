/**
 * 文章详情页面 - 全屏布局
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Sparkles,
  Bookmark,
  Clock,
  Calendar,
  User,
} from 'lucide-react';
import { Button, Card, Spin, Empty, Tag, Space, Tooltip, message, Divider, Typography } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { cn } from '@/lib/utils';

const { Title, Text, Paragraph } = Typography;

export default function EntryPage() {
  const params = useParams();
  const router = useRouter();
  const entryId = params.id as string;

  const { data: entry, isLoading, refetch } = trpc.entries.byId.useQuery({ id: entryId });
  const analyzeMutation = trpc.entries.analyze.useMutation();
  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Spin size="large" />
          </main>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Empty description="文章不存在" />
          </main>
        </div>
      </div>
    );
  }

  const handleAnalyze = async (type: 'summary' | 'all') => {
    setIsAnalyzing(true);
    try {
      await analyzeMutation.mutateAsync({
        entryId: entry.id,
        analysisType: type,
      });
      handleApiSuccess('AI 分析完成');
      refetch();
    } catch (error) {
      handleApiError(error, 'AI 分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleStar = async () => {
    try {
      await toggleStar.mutateAsync({ entryId: entry.id });
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const handleToggleRead = async () => {
    try {
      await toggleRead.mutateAsync({ entryId: entry.id });
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const formatReadingTime = (seconds?: number | null) => {
    if (!seconds) return '';
    const minutes = Math.ceil(seconds / 60);
    return minutes > 0 ? `${minutes} 分钟阅读` : '';
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* 返回按钮 */}
            <Button
              type="text"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.back()}
              className="mb-4 hover:bg-muted/30"
            >
              返回
            </Button>

            {/* 文章头部 */}
            <Card className="mb-6 border-border/60">
              {/* 订阅源信息 */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/60">
                {entry.feed.iconUrl && (
                  <img src={entry.feed.iconUrl} alt="" className="w-6 h-6 rounded-md" />
                )}
                <span className="text-sm text-muted-foreground">{entry.feed.title}</span>
                <a
                  href={entry.feed.siteUrl || entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                >
                  <Button type="link" size="small" icon={<ExternalLink className="h-4 w-4" />}>
                    访问网站
                  </Button>
                </a>
              </div>

              {/* 标题 */}
              <Title level={2} className="mb-4">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {entry.title}
                </a>
              </Title>

              {/* 元信息 */}
              <Space size="large" wrap className="text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {entry.publishedAt && formatDistanceToNow(new Date(entry.publishedAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
                {entry.readingTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatReadingTime(entry.readingTime)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {entry.author || '未知作者'}
                </span>
              </Space>

              {/* AI 标签 */}
              {entry.aiCategory && (
                <div className="mb-4">
                  <Tag
                    icon={<Sparkles className="h-3 w-3" />}
                    className="rounded-full border-primary/30 bg-primary/5 text-primary/80"
                  >
                    {entry.aiCategory}
                  </Tag>
                </div>
              )}

              {/* 操作按钮 */}
              <Space>
                <Tooltip title={entry.isRead ? '标记为未读' : '标记为已读'}>
                  <Button
                    type={entry.isRead ? 'default' : 'primary'}
                    size="small"
                    icon={<Bookmark className={cn('h-4 w-4', entry.isRead && 'fill-current')} />}
                    onClick={handleToggleRead}
                  >
                    {entry.isRead ? '未读' : '已读'}
                  </Button>
                </Tooltip>
                <Tooltip title={entry.isStarred ? '取消星标' : '添加星标'}>
                  <Button
                    type={entry.isStarred ? 'primary' : 'default'}
                    size="small"
                    icon={<Star className={cn('h-4 w-4', entry.isStarred && 'fill-current text-yellow-500')} />}
                    onClick={handleToggleStar}
                  >
                    {entry.isStarred ? '已星标' : '星标'}
                  </Button>
                </Tooltip>
                <Button
                  type="primary"
                  size="small"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={() => handleAnalyze('summary')}
                  loading={isAnalyzing}
                >
                  AI 摘要
                </Button>
                <Button
                  type="default"
                  size="small"
                  icon={<ExternalLink className="h-4 w-4" />}
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  原文
                </Button>
              </Space>
            </Card>

            {/* AI 摘要 */}
            {entry.aiSummary && (
              <Card className="mb-6 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/10" title={
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  AI 摘要
                </div>
              }>
                <Paragraph className="text-foreground/80 mb-0">
                  {entry.aiSummary}
                </Paragraph>
              </Card>
            )}

            {/* 文章内容 */}
            <Card title="文章内容" className="border-border/60">
              {entry.content ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: entry.content }}
                />
              ) : entry.summary ? (
                <Paragraph className="text-muted-foreground mb-0">
                  {entry.summary}
                </Paragraph>
              ) : (
                <Empty description="暂无内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
