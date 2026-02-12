/**
 * 文章详情页面 - 全屏布局（优化版）
 *
 * 功能：
 * - 左侧：文章内容（完整内容，支持自动抓取）
 * - 右侧：AI 总结侧栏（包含所有 AI 分析功能）
 * - 阅读进度条
 * - 返回顶部按钮
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
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
  Hash,
  BarChart3,
  Zap,
  ChevronUp,
  Brain,
  FileText,
  Target,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { Button, Card, Empty, Tag, Space, Tooltip, Divider, Typography, Badge, Skeleton } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { Fade, StaggerContainer } from '@/components/animation/fade';
import { Typewriter } from '@/components/animation/typewriter';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spinner, LoadingDots } from '@/components/animation/loading';
import { usePageLoadAnimation, useScrollProgress, useRipple } from '@/hooks/use-animation';
import { RichContentRenderer } from '@/components/entries/rich-content-renderer';

const { Title, Text, Paragraph } = Typography;

/**
 * 波纹按钮组件
 */
function RippleButton({
  children,
  onClick,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { onClick?: (e: React.MouseEvent<HTMLElement>) => void }) {
  const createRipple = useRipple();

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    createRipple(e);
    onClick?.(e);
  }, [createRipple, onClick]);

  return (
    <Button {...props} onClick={handleClick} className={cn('relative overflow-hidden', className)}>
      {children}
    </Button>
  );
}

/**
 * 阅读进度条组件
 */
function ReadingProgressBar() {
  const progress = useScrollProgress();

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-all duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

/**
 * 返回顶部按钮
 */
function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const progress = useScrollProgress();

  useEffect(() => {
    setIsVisible(progress > 0.2);
  }, [progress]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Fade in={isVisible} direction="up" distance={20} duration={300}>
      <button
        onClick={scrollToTop}
        className={cn(
          'fixed bottom-8 right-8 z-40',
          'w-12 h-12 rounded-full',
          'bg-card border border-border/60 shadow-lg',
          'flex items-center justify-center',
          'hover:bg-muted/50 hover:scale-110 hover:shadow-xl',
          'transition-all duration-300 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-primary/30'
        )}
        aria-label="返回顶部"
      >
        <ChevronUp className="w-5 h-5 text-muted-foreground" />
      </button>
    </Fade>
  );
}

/**
 * 元信息项组件
 */
function MetaItem({
  icon,
  label,
  value,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delay?: number;
}) {
  return (
    <Fade delay={delay} direction="up" distance={8} duration={400}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/50">
          {icon}
        </span>
        <span className="hidden sm:inline">{label}:</span>
        <span className="font-medium text-foreground/80">{value}</span>
      </div>
    </Fade>
  );
}

/**
 * AI 关键词标签组件
 */
function AIKeywords({ keywords, delay = 0 }: { keywords?: string[] | null; delay?: number }) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <Fade delay={delay} direction="up" distance={8} duration={400}>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Hash className="w-3.5 h-3.5" />
          关键词:
        </span>
        {keywords.slice(0, 8).map((keyword, index) => (
          <Tag
            key={keyword}
            className={cn(
              'rounded-full text-xs border-primary/20 bg-primary/5 text-primary/80',
              'hover:bg-primary/10 hover:border-primary/30 transition-all duration-200',
              'animate-fadeIn'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {keyword}
          </Tag>
        ))}
      </div>
    </Fade>
  );
}

/**
 * AI 侧栏组件
 */
function AISidebar({ entry }: { entry: any }) {
  const [activeTab, setActiveTab] = useState<'summary' | 'analysis' | 'keywords'>('summary');

  // 检查是否有任何AI分析结果（排除默认值）
  const hasAIAnalysis = !!(
    entry.aiSummary ||
    entry.aiCategory ||
    (entry.aiKeywords && entry.aiKeywords.length > 0) ||
    entry.aiSentiment ||
    (entry.aiImportanceScore && entry.aiImportanceScore > 0)
  );

  return (
    <aside className="w-80 flex-shrink-0 border-l border-border/60 bg-muted/30 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* AI 标题 */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI 分析</h3>
            <p className="text-xs text-muted-foreground">智能内容理解</p>
          </div>
        </div>

        {/* 分析中状态 */}
        {!hasAIAnalysis && (
          <>
            <Card size="small" className="bg-muted/30 border-dashed">
              <div className="flex flex-col items-center gap-3 py-4">
                <LoadingDots size="sm" />
                <p className="text-sm text-muted-foreground text-center">
                  暂无AI分析结果
                </p>
                <p className="text-xs text-muted-foreground/60 text-center">
                  新抓取的文章会自动进行AI分析
                </p>
              </div>
            </Card>

            {/* 提示信息 */}
            <div className="text-xs text-muted-foreground/60 text-center space-y-1">
              <p><strong>提示：</strong>旧文章不会自动分析</p>
              <p>可以尝试重新抓取订阅源来分析所有文章</p>
            </div>
          </>
        )}

        {/* AI 摘要 */}
        {entry.aiSummary && (
          <Card
            size="small"
            className={cn(
              'bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5',
              'border-primary/10'
            )}
            title={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">AI 摘要</span>
              </div>
            }
          >
            <div className="text-foreground/80 leading-relaxed text-sm">
              <Typewriter
                text={entry.aiSummary}
                speed={20}
                delay={400}
                showCursor={false}
              />
            </div>
          </Card>
        )}

        {/* AI 分类 */}
        {entry.aiCategory && (
          <Card
            size="small"
            className="bg-card/50"
            title={
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">分类</span>
              </div>
            }
          >
            <Tag
              icon={<Sparkles className="h-3 w-3" />}
              className="rounded-full border-primary/30 bg-primary/5 text-primary/80"
            >
              {entry.aiCategory}
            </Tag>
          </Card>
        )}

        {/* 重要度 */}
        {entry.aiImportanceScore && entry.aiImportanceScore > 0 && (
          <Card
            size="small"
            className="bg-card/50"
            title={
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">重要度</span>
              </div>
            }
          >
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                    style={{ width: `${entry.aiImportanceScore * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-primary">
                {Math.round(entry.aiImportanceScore * 100)}
              </span>
            </div>
          </Card>
        )}

        {/* 关键词 */}
        {entry.aiKeywords && entry.aiKeywords.length > 0 && (
          <Card
            size="small"
            className="bg-card/50"
            title={
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">关键词</span>
              </div>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {entry.aiKeywords.slice(0, 10).map((keyword: string) => (
                <Tag
                  key={keyword}
                  className="rounded-full text-xs border-primary/20 bg-primary/5 text-primary/80"
                >
                  {keyword}
                </Tag>
              ))}
            </div>
          </Card>
        )}

        {/* 情感分析 */}
        {entry.aiSentiment && (
          <Card
            size="small"
            className="bg-card/50"
            title={
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">情感倾向</span>
              </div>
            }
          >
            <Badge
              status={entry.aiSentiment === 'positive' ? 'success' : entry.aiSentiment === 'negative' ? 'error' : 'default'}
              text={entry.aiSentiment === 'positive' ? '积极' : entry.aiSentiment === 'negative' ? '消极' : '中性'}
            />
          </Card>
        )}
      </div>
    </aside>
  );
}

/**
 * 加载状态组件
 */
function LoadingState() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 flex">
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" variant="primary" />
            <p className="text-sm text-muted-foreground animate-pulse">加载文章中...</p>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * 空状态组件
 */
function EmptyState() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 flex">
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>
        <main className="flex-1 flex items-center justify-center">
          <Empty
            description={
              <Fade direction="up" distance={10}>
                <span className="text-muted-foreground">文章不存在或已被删除</span>
              </Fade>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </main>
      </div>
    </div>
  );
}

export default function EntryPage() {
  const params = useParams();
  const router = useRouter();
  const entryId = params.id as string;
  const isLoaded = usePageLoadAnimation(150);

  const { data: entry, isLoading, error, refetch } = trpc.entries.byId.useQuery({ id: entryId });
  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();

  // 乐观更新状态
  const [optimisticStarred, setOptimisticStarred] = useState<boolean | null>(null);
  const [optimisticRead, setOptimisticRead] = useState<boolean | null>(null);

  // 使用乐观值或原始值
  const displayEntry = entry
    ? {
        ...entry,
        isStarred: optimisticStarred ?? entry.isStarred,
        isRead: optimisticRead ?? entry.isRead,
      }
    : null;

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <div className="flex-1 flex">
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Empty
              description={
                <Fade direction="up" distance={10}>
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">加载文章失败</p>
                    <p className="text-sm text-red-500 mb-4">{error.message}</p>
                    <Button type="primary" onClick={() => refetch()}>
                      重试
                    </Button>
                  </div>
                </Fade>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </main>
        </div>
      </div>
    );
  }

  if (!entry || !displayEntry) {
    return <EmptyState />;
  }

  const handleToggleStar = async () => {
    if (!entry) return;

    const newStarredState = !entry.isStarred;
    setOptimisticStarred(newStarredState);

    try {
      await toggleStar.mutateAsync({ entryId: entry.id });
      handleApiSuccess(newStarredState ? '已添加星标 ⭐' : '已取消星标');
      refetch();
    } catch (error) {
      setOptimisticStarred(null);
      handleApiError(error, '操作失败');
    }
  };

  const handleToggleRead = async () => {
    if (!entry) return;

    const newReadState = !entry.isRead;
    setOptimisticRead(newReadState);

    try {
      await toggleRead.mutateAsync({ entryId: entry.id });
      handleApiSuccess(newReadState ? '已标记为已读 ✓' : '已标记为未读');
      refetch();
    } catch (error) {
      setOptimisticRead(null);
      handleApiError(error, '操作失败');
    }
  };

  const formatReadingTime = (seconds?: number | null) => {
    if (!seconds) return '';
    const minutes = Math.ceil(seconds / 60);
    return minutes > 0 ? `${minutes} 分钟` : '';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ReadingProgressBar />
      <AppHeader />

      <div className="flex-1 flex">
        {/* 左侧边栏 */}
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>

        {/* 主内容区 - 分为文章内容和 AI 侧栏 */}
        <main className="flex-1 flex bg-background/30">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* 返回按钮 */}
              <Fade in={isLoaded} direction="right" distance={15} duration={400}>
                <Button
                  type="text"
                  icon={<ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />}
                  onClick={() => router.back()}
                  className="group mb-6 hover:bg-muted/40 transition-all duration-300 rounded-lg px-3 py-2 -ml-2"
                >
                  <span className="ml-1">返回</span>
                </Button>
              </Fade>

              {/* 文章头部 */}
              <Fade in={isLoaded} delay={100} direction="up" distance={20} duration={500}>
                <Card
                  className={cn(
                    'mb-6 border-border/60',
                    'hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5',
                    'transition-all duration-500'
                  )}
                >
                  <StaggerContainer staggerDelay={80} initialDelay={200}>
                    {/* 订阅源信息 */}
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
                      {displayEntry.feed.iconUrl && (
                        <div className="relative">
                          <img
                            src={displayEntry.feed.iconUrl}
                            alt=""
                            className="w-7 h-7 rounded-lg shadow-sm"
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {displayEntry.feed.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {displayEntry.feed.categoryId || '未分类'}
                        </div>
                      </div>
                      <a
                        href={(displayEntry.feed as any).siteUrl || displayEntry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <Button
                          type="link"
                          size="small"
                          icon={<ExternalLink className="w-4 h-4" />}
                          className="hover:text-primary transition-colors"
                        >
                          访问网站
                        </Button>
                      </a>
                    </div>

                    {/* 标题 */}
                    <Title level={2} className="mb-4 leading-tight">
                      <a
                        href={displayEntry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors duration-300 hover:underline decoration-2 underline-offset-4"
                      >
                        {displayEntry.title}
                      </a>
                    </Title>

                    {/* 状态徽章 */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {displayEntry.isRead && (
                        <StatusBadge status="success" animated={false}>
                          已读
                        </StatusBadge>
                      )}
                      {displayEntry.isStarred && (
                        <StatusBadge status="warning" animated={false}>
                          已星标
                        </StatusBadge>
                      )}
                    </div>

                    {/* 元信息网格 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      <MetaItem
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label="发布"
                        value={
                          displayEntry.publishedAt &&
                          formatDistanceToNow(new Date(displayEntry.publishedAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })
                        }
                        delay={200}
                      />
                      {displayEntry.readingTime && (
                        <MetaItem
                          icon={<Clock className="w-3.5 h-3.5" />}
                          label="阅读时间"
                          value={formatReadingTime(displayEntry.readingTime)}
                          delay={280}
                        />
                      )}
                      <MetaItem
                        icon={<User className="w-3.5 h-3.5" />}
                        label="作者"
                        value={displayEntry.author || '未知作者'}
                        delay={360}
                      />
                    </div>

                    {/* 操作按钮 */}
                    <Fade delay={500} direction="up" distance={10} duration={400}>
                      <Space wrap className="pt-4 border-t border-border/40">
                        {/* 已读/未读按钮 */}
                        <Tooltip title={displayEntry.isRead ? '标记为未读' : '标记为已读'}>
                          <RippleButton
                            type={displayEntry.isRead ? 'default' : 'primary'}
                            size="small"
                            icon={
                              <Bookmark
                                className={cn(
                                  'w-4 h-4 transition-all duration-300',
                                  displayEntry.isRead && 'fill-primary text-primary'
                                )}
                              />
                            }
                            onClick={handleToggleRead}
                          >
                            {displayEntry.isRead ? '已读' : '未读'}
                          </RippleButton>
                        </Tooltip>

                        {/* 星标按钮 */}
                        <Tooltip title={displayEntry.isStarred ? '取消星标' : '添加星标'}>
                          <RippleButton
                            type={displayEntry.isStarred ? 'primary' : 'default'}
                            size="small"
                            icon={
                              <Star
                                className={cn(
                                  'w-4 h-4 transition-all duration-300',
                                  displayEntry.isStarred && 'fill-yellow-400 text-yellow-500',
                                  !displayEntry.isStarred && 'hover:text-yellow-500'
                                )}
                              />
                            }
                            onClick={handleToggleStar}
                          >
                            {displayEntry.isStarred ? '已星标' : '星标'}
                          </RippleButton>
                        </Tooltip>

                        {/* 原文按钮 */}
                        <RippleButton
                          type="default"
                          size="small"
                          icon={<ExternalLink className="w-4 h-4" />}
                          href={displayEntry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          原文
                        </RippleButton>
                      </Space>
                    </Fade>
                  </StaggerContainer>
                </Card>
              </Fade>

              {/* 文章内容 */}
              <Fade in={isLoaded} delay={300} direction="up" distance={20} duration={500}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">文章内容</span>
                    </div>
                  }
                  className={cn(
                    'border-border/60',
                    'hover:border-primary/10 transition-all duration-500'
                  )}
                >
                  {displayEntry.content ? (
                    <RichContentRenderer html={displayEntry.content} />
                  ) : displayEntry.summary ? (
                    <Paragraph className="text-muted-foreground mb-0 leading-relaxed">
                      {displayEntry.summary}
                    </Paragraph>
                  ) : (
                    <Empty
                      description="暂无内容"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      className="py-12"
                    />
                  )}
                </Card>
              </Fade>
            </div>
          </div>

          {/* AI 侧栏 */}
          <AISidebar
            entry={displayEntry}
          />
        </main>
      </div>

      <BackToTop />
    </div>
  );
}
