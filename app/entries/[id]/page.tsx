/**
 * 文章详情页面 - 全屏布局 (优化版)
 * 
 * 优化内容：
 * 1. 页面加载动画和过渡效果
 * 2. AI摘要区域打字机动画
 * 3. 星标/已读按钮微交互
 * 4. 文章内容进入动画
 * 5. 元信息展示增强
 * 6. 返回按钮交互优化
 * 7. 阅读进度指示器
 * 8. 文章内容排版增强
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
  Eye,
  Share2,
  ChevronUp,
} from 'lucide-react';
import { Button, Card, Empty, Tag, Space, Tooltip, Divider, Typography, Badge } from 'antd';
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
import { AdvancedAIPanel } from '@/components/entries/advanced-ai-panel';

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
 * 操作按钮组组件
 */
function ActionButtons({
  entry,
  onToggleStar,
  onToggleRead,
  onAnalyze,
  isAnalyzing,
  delay = 0,
}: {
  entry: any;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onAnalyze: (type: 'summary' | 'all') => void;
  isAnalyzing: boolean;
  delay?: number;
}) {
  return (
    <Fade delay={delay} direction="up" distance={10} duration={400}>
      <Space wrap className="mt-5 pt-4 border-t border-border/40">
        {/* 已读/未读按钮 */}
        <Tooltip title={entry.isRead ? '标记为未读' : '标记为已读'}>
          <RippleButton
            type={entry.isRead ? 'default' : 'primary'}
            size="small"
            icon={
              <Bookmark
                className={cn(
                  'w-4 h-4 transition-all duration-300',
                  entry.isRead && 'fill-primary text-primary'
                )}
              />
            }
            onClick={onToggleRead}
            className={cn(
              'transition-all duration-300',
              entry.isRead
                ? 'hover:bg-primary/10 hover:border-primary/30'
                : 'hover:shadow-md hover:shadow-primary/20'
            )}
          >
            {entry.isRead ? '已读' : '未读'}
          </RippleButton>
        </Tooltip>

        {/* 星标按钮 */}
        <Tooltip title={entry.isStarred ? '取消星标' : '添加星标'}>
          <RippleButton
            type={entry.isStarred ? 'primary' : 'default'}
            size="small"
            icon={
              <Star
                className={cn(
                  'w-4 h-4 transition-all duration-300',
                  entry.isStarred && 'fill-yellow-400 text-yellow-500',
                  !entry.isStarred && 'hover:text-yellow-500'
                )}
              />
            }
            onClick={onToggleStar}
            className={cn(
              'transition-all duration-300',
              entry.isStarred
                ? 'hover:shadow-md hover:shadow-yellow-500/20'
                : 'hover:bg-yellow-50 hover:border-yellow-200'
            )}
          >
            {entry.isStarred ? '已星标' : '星标'}
          </RippleButton>
        </Tooltip>

        {/* AI 摘要按钮 */}
        <RippleButton
          type="primary"
          size="small"
          icon={isAnalyzing ? <LoadingDots size="sm" /> : <Sparkles className="w-4 h-4" />}
          onClick={() => onAnalyze('summary')}
          loading={isAnalyzing}
          className="bg-gradient-to-r from-primary to-primary/90 hover:shadow-md hover:shadow-primary/25 transition-all duration-300"
        >
          {isAnalyzing ? '分析中...' : 'AI 摘要'}
        </RippleButton>

        {/* 原文按钮 */}
        <RippleButton
          type="default"
          size="small"
          icon={<ExternalLink className="w-4 h-4" />}
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-muted/50 transition-all duration-300"
        >
          原文
        </RippleButton>
      </Space>
    </Fade>
  );
}

/**
 * 加载状态组件
 */
function LoadingState() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex overflow-hidden">
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
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex overflow-hidden">
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

  const { data: entry, isLoading, refetch } = trpc.entries.byId.useQuery({ id: entryId });
  const analyzeMutation = trpc.entries.analyze.useMutation();
  const toggleStar = trpc.entries.toggleStar.useMutation();
  const toggleRead = trpc.entries.toggleRead.useMutation();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAISummary, setShowAISummary] = useState(false);

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

  // 当 AI 摘要加载后触发显示动画
  useEffect(() => {
    if (displayEntry?.aiSummary) {
      const timer = setTimeout(() => setShowAISummary(true), 300);
      return () => clearTimeout(timer);
    }
  }, [displayEntry?.aiSummary]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!entry || !displayEntry) {
    return <EmptyState />;
  }

  const handleAnalyze = async (type: 'summary' | 'all') => {
    setIsAnalyzing(true);
    setShowAISummary(false);
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
    <div className="h-screen flex flex-col overflow-hidden">
      <ReadingProgressBar />
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30 scroll-smooth">
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
                    {displayEntry.aiCategory && (
                      <StatusBadge status="info" pulse>
                        {displayEntry.aiCategory}
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
                    {displayEntry.aiImportanceScore && (
                      <MetaItem
                        icon={<BarChart3 className="w-3.5 h-3.5" />}
                        label="重要度"
                        value={`${Math.round(displayEntry.aiImportanceScore * 100)}/100`}
                        delay={440}
                      />
                    )}
                  </div>

                  {/* AI 关键词 */}
                  <AIKeywords keywords={displayEntry.aiKeywords} delay={500} />

                  {/* 操作按钮 */}
                  <ActionButtons
                    entry={displayEntry}
                    onToggleStar={handleToggleStar}
                    onToggleRead={handleToggleRead}
                    onAnalyze={handleAnalyze}
                    isAnalyzing={isAnalyzing}
                    delay={600}
                  />
                </StaggerContainer>
              </Card>
            </Fade>

            {/* AI 摘要 */}
            {displayEntry.aiSummary && (
              <Fade
                in={showAISummary}
                direction="up"
                distance={20}
                duration={500}
                className="mb-6"
              >
                <Card
                  className={cn(
                    'bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5',
                    'border-primary/10 hover:border-primary/20',
                    'transition-all duration-500 hover:shadow-lg hover:shadow-primary/10'
                  )}
                  title={
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-primary">AI 智能摘要</span>
                        <div className="text-xs text-muted-foreground">由 AI 自动生成</div>
                      </div>
                    </div>
                  }
                >
                  <div className="text-foreground/80 leading-relaxed">
                    <Typewriter
                      text={displayEntry.aiSummary}
                      speed={20}
                      delay={400}
                      showCursor={false}
                      className="text-[15px]"
                    />
                  </div>
                </Card>
              </Fade>
            )}

            {/* 高级AI分析面板 */}
            <Fade in={isLoaded} direction="up" distance={20} duration={500} className="mb-6">
              <AdvancedAIPanel entry={displayEntry} />
            </Fade>

            {/* 文章内容 */}
            <Fade in={isLoaded} delay={300} direction="up" distance={20} duration={500}>
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
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

            {/* 底部分享区域 */}
            <Fade in={isLoaded} delay={500} direction="up" distance={15} duration={400}>
              <div className="mt-8 pt-6 border-t border-border/60">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <Text className="text-sm text-muted-foreground">
                    觉得这篇文章有帮助？分享给更多人
                  </Text>
                  <Space>
                    <Tooltip title="分享文章">
                      <Button
                        icon={<Share2 className="w-4 h-4" />}
                        size="small"
                        className="hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        分享
                      </Button>
                    </Tooltip>
                    <Tooltip title={displayEntry.isStarred ? '取消星标' : '添加星标'}>
                      <Button
                        icon={
                          <Star
                            className={cn(
                              'w-4 h-4',
                              displayEntry.isStarred && 'fill-yellow-400 text-yellow-500'
                            )}
                          />
                        }
                        size="small"
                        onClick={handleToggleStar}
                        className={cn(
                          'transition-all duration-300',
                          displayEntry.isStarred && 'bg-yellow-50 border-yellow-200'
                        )}
                      >
                        {displayEntry.isStarred ? '已收藏' : '收藏'}
                      </Button>
                    </Tooltip>
                  </Space>
                </div>
              </div>
            </Fade>
          </div>
        </main>
      </div>

      <BackToTop />
    </div>
  );
}
