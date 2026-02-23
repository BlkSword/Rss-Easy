/**
 * 文章详情页面 - 全屏布局（优化版）
 *
 * 功能：
 * - 左侧：导航侧边栏（可折叠）
 * - 中间：文章内容（完整内容，支持自动抓取）
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
  Settings,
  HelpCircle,
  CheckCircle,
  XCircle,
  Loader2,
  PanelLeft,
} from 'lucide-react';
import { Button, Card as AntCard, Empty, Tag, Space, Tooltip, Divider, Typography, Badge, Skeleton } from 'antd';
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
import { useIsMobile } from '@/hooks/use-media-query';
import { useUserPreferences } from '@/hooks/use-local-storage';
import { AIAnalysisSidebar } from '@/components/entries/ai-analysis-sidebar';
import { Card } from '@/components/ui/card';

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
 * 加载状态组件
 */
function LoadingState({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 - 只在非移动端显示 */}
        {!isMobile && (
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/20">
            <AppSidebar />
          </aside>
        )}
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
function EmptyState({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 - 只在非移动端显示 */}
        {!isMobile && (
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/20">
            <AppSidebar />
          </aside>
        )}
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
  const isMobile = useIsMobile();
  const { sidebarCollapsed } = useUserPreferences();

  // 侧边栏折叠状态（非移动端可折叠）
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarCollapsed);

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

  // 切换侧边栏折叠状态
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  if (isLoading) {
    return <LoadingState isMobile={isMobile} />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <div className="flex-1 flex overflow-hidden">
          {/* 侧边栏 - 只在非移动端显示 */}
          {!isMobile && (
            <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/20">
              <AppSidebar />
            </aside>
          )}
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
    return <EmptyState isMobile={isMobile} />;
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

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 - 响应式：移动端隐藏，桌面端可折叠 */}
        {!isMobile && (
          <aside 
            className={cn(
              "flex-shrink-0 border-r border-border/60 bg-muted/20 transition-all duration-300 ease-in-out",
              isSidebarCollapsed ? "w-16" : "w-60"
            )}
          >
            <AppSidebar collapsed={isSidebarCollapsed} />
          </aside>
        )}

        {/* 主内容区 - 分为文章内容和 AI 侧栏 */}
        <main className="flex-1 flex bg-background/30 overflow-hidden">
          {/* 文章内容区 - 响应式：无 AI 侧栏时占满，有 AI 侧栏时自适应 */}
          <div className={cn(
            "flex-1 overflow-y-auto",
            !isMobile && displayEntry && "max-w-full xl:max-w-[calc(100%-20rem)]"
          )}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {/* 返回按钮和侧边栏切换 */}
              <Fade in={isLoaded} direction="right" distance={15} duration={400}>
                <div className="flex items-center gap-2 mb-6">
                  {/* 侧边栏折叠/展开按钮 - 只在桌面端显示 */}
                  {!isMobile && (
                    <Tooltip title={isSidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}>
                      <Button
                        type="text"
                        icon={<PanelLeft className="w-4 h-4" />}
                        onClick={toggleSidebar}
                        className="hover:bg-muted/40 transition-all duration-300 rounded-lg px-3 py-2 -ml-2"
                      />
                    </Tooltip>
                  )}
                  <Button
                    type="text"
                    icon={<ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />}
                    onClick={() => router.back()}
                    className="group hover:bg-muted/40 transition-all duration-300 rounded-lg px-3 py-2"
                  >
                    <span className="ml-1">返回</span>
                  </Button>
                </div>
              </Fade>

              {/* 文章头部 */}
              <Fade in={isLoaded} delay={100} direction="up" distance={20} duration={500}>
                <Card
                  isHoverable
                  className="mb-6"
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
                <AntCard
                  title={
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">文章内容</span>
                    </div>
                  }
                  className="border-border/60"
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
                </AntCard>
              </Fade>
            </div>
          </div>

          {/* AI 侧栏 - 只在桌面端显示 */}
          {!isMobile && (
            <AIAnalysisSidebar entry={displayEntry} />
          )}
        </main>
      </div>

      <BackToTop />
    </div>
  );
}
