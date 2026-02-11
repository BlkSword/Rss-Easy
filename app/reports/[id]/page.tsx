/**
 * 报告详情页面 - 全屏布局
 * 优化版：支持显示生成进度和步骤
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Download,
  Share2,
  Trash2,
  FileText,
  Calendar,
  TrendingUp,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Star,
  FolderOpen,
  Lightbulb,
  Loader2,
  AlertCircle,
  Check,
  Clock,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button, Card, Row, Col, Select, Space, Modal, Typography, Tag, Progress, Steps, Tooltip } from 'antd';
import { useToast } from '@/components/ui/toast';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError, notifySuccess, notifyError } from '@/lib/feedback';

// 动画组件
import { Fade, StaggerContainer, ListItemFade, HoverLift } from '@/components/animation/fade';
import { AnimatedNumber } from '@/components/animation/animated-number';
import { Spinner, LoadingDots } from '@/components/animation/loading';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

// Hooks
import { usePageLoadAnimation } from '@/hooks/use-animation';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// 报告类型配置
const reportTypeConfig = {
  daily: {
    icon: Calendar,
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500/20',
    gradient: 'from-blue-500/5 to-blue-500/0',
  },
  weekly: {
    icon: TrendingUp,
    color: 'purple',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500',
    borderColor: 'border-purple-500/20',
    gradient: 'from-purple-500/5 to-purple-500/0',
  },
};

// 生成步骤映射
const STEP_LABELS: Record<string, string> = {
  init: '初始化',
  collect_data: '收集数据',
  analyze_entries: '分析文章',
  generate_summary: '生成摘要',
  extract_topics: '提取主题',
  select_highlights: '精选内容',
  finalize: '完成报告',
};

// 页面加载骨架屏
function ReportDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
      <Card className="border-border/60">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </Card>
      <Card className="border-border/60">
        <Skeleton className="h-64 rounded-xl" />
      </Card>
    </div>
  );
}

// 生成中状态组件
function GeneratingState({ 
  progress, 
  currentStep, 
  steps,
  errorMessage,
  onCancel 
}: { 
  progress: number; 
  currentStep: string;
  steps: any[];
  errorMessage?: string;
  onCancel: () => void;
}) {
  // 转换步骤为Steps组件格式
  const stepItems = steps.map((s, index) => {
    const isDone = s.status === 'done';
    const isDoing = s.status === 'doing';
    const isError = s.status === 'error';
    
    return {
      title: s.label || STEP_LABELS[s.step] || s.step,
      description: s.message || (isDoing ? '进行中...' : ''),
      status: isError ? 'error' : isDone ? 'finish' : isDoing ? 'process' : 'wait' as const,
      icon: isDoing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined,
    };
  });

  const currentStepIndex = steps.findIndex((s) => s.status === 'doing');

  return (
    <Card className="border-border/60 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center animate-pulse">
          <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">正在生成报告</h3>
          <p className="text-sm text-muted-foreground">
            {currentStep || '准备中...'} · {progress}%
          </p>
        </div>
        <Button 
          icon={<X className="h-4 w-4" />} 
          onClick={onCancel}
        >
          取消
        </Button>
      </div>

      <div className="mb-6">
        <Progress 
          percent={progress} 
          strokeColor="#ea580c"
          showInfo={false}
          className="mb-2"
        />
      </div>

      <Steps
        direction="horizontal"
        size="small"
        current={currentStepIndex}
        items={stepItems}
        className="overflow-x-auto"
      />

      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">生成失败</span>
          </div>
          <p className="text-sm text-red-600/80 mt-1">{errorMessage}</p>
        </div>
      )}
    </Card>
  );
}

// 统计卡片组件
function StatCard({
  value,
  suffix = '',
  label,
  icon,
  color,
  delay = 0,
}: {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}) {
  return (
    <ListItemFade index={delay / 50} baseDelay={50}>
      <HoverLift lift={3} shadow={false}>
        <div
          className={cn(
            'p-4 rounded-xl border transition-all duration-300',
            'bg-gradient-to-br hover:shadow-md',
            color === 'blue' && 'border-blue-500/20 from-blue-500/5 to-blue-500/0',
            color === 'purple' && 'border-purple-500/20 from-purple-500/5 to-purple-500/0',
            color === 'green' && 'border-green-500/20 from-green-500/5 to-green-500/0',
            color === 'orange' && 'border-orange-500/20 from-orange-500/5 to-orange-500/0'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                <AnimatedNumber value={value} suffix={suffix} duration={1000} />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </div>
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                color === 'blue' && 'bg-blue-500/10 text-blue-500',
                color === 'purple' && 'bg-purple-500/10 text-purple-500',
                color === 'green' && 'bg-green-500/10 text-green-500',
                color === 'orange' && 'bg-orange-500/10 text-orange-500'
              )}
            >
              {icon}
            </div>
          </div>
        </div>
      </HoverLift>
    </ListItemFade>
  );
}

// 主题标签组件
function TopicTag({ topic, count, maxCount, index }: { topic: string; count: number; maxCount: number; index: number }) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const intensity = Math.max(20, percentage);

  return (
    <ListItemFade index={index} baseDelay={60}>
      <HoverLift lift={2} shadow={false}>
        <div className="relative p-4 rounded-xl border border-border/60 bg-muted/5 hover:bg-muted/10 transition-all duration-300 overflow-hidden group cursor-pointer">
          {/* 背景进度条 */}
          <div
            className="absolute inset-y-0 left-0 bg-primary/5 transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          />
          <div className="relative z-10">
            <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {topic}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{count} 篇</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </HoverLift>
    </ListItemFade>
  );
}

// 文章列表项组件
function EntryItem({ entry, index }: { entry: any; index: number }) {
  const sectionIcons = {
    highlights: { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: '精选' },
    topic: { icon: FolderOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', label: '专题' },
    recommendation: { icon: Lightbulb, color: 'text-green-500', bg: 'bg-green-500/10', label: '推荐' },
    default: { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted', label: '文章' },
  };

  const sectionConfig = sectionIcons[entry.section as keyof typeof sectionIcons] || sectionIcons.default;
  const SectionIcon = sectionConfig.icon;

  return (
    <ListItemFade index={index} baseDelay={50}>
      <HoverLift lift={2} shadow={false}>
        <a
          href={`/entries/${entry.entryId}`}
          className="block p-4 rounded-xl border border-border/60 bg-muted/5 hover:bg-muted/10 hover:border-primary/30 transition-all duration-300 group"
        >
          <div className="flex items-start gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', sectionConfig.bg)}>
              <SectionIcon className={cn('h-4 w-4', sectionConfig.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                {entry.entry?.title}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className={cn('flex items-center gap-1', sectionConfig.color)}>
                  {sectionConfig.label}
                </span>
                <span>·</span>
                <span>排名 #{entry.rank}</span>
                {entry.entry?.feed?.title && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[150px]">{entry.entry.feed.title}</span>
                  </>
                )}
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </a>
      </HoverLift>
    </ListItemFade>
  );
}

export default function ReportDetailPage() {
  const { addToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'html' | 'json'>('markdown');

  // 页面加载动画
  const isPageLoaded = usePageLoadAnimation(100);

  const { data: report, isLoading, refetch } = trpc.reports.byId.useQuery({ id: reportId });
  const { data: progressData } = trpc.reports.getProgress.useQuery(
    { id: reportId },
    {
      enabled: report?.status === 'generating' || report?.status === 'pending',
      refetchInterval: (data) => 
        data?.status === 'generating' || data?.status === 'pending' ? 2000 : false,
    }
  );
  
  const deleteReport = trpc.reports.delete.useMutation();
  const cancelGeneration = trpc.reports.cancelGeneration.useMutation();

  const handleDownload = () => {
    const blob = new Blob([report?.content || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report?.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: '下载成功' });
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      addToast({ type: 'success', title: '链接已复制到剪贴板' });
    } catch (error) {
      addToast({ type: 'error', title: '复制失败' });
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此报告吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteReport.mutateAsync({ id: reportId });
          handleApiSuccess('删除成功');
          router.push('/reports');
        } catch (error) {
          handleApiError(error, '删除失败');
        }
      },
    });
  };

  const handleCancel = async () => {
    try {
      await cancelGeneration.mutateAsync({ id: reportId });
      notifySuccess('已取消生成');
      refetch();
    } catch (error) {
      handleApiError(error, '取消失败');
    }
  };

  // 计算统计数据
  const readRate =
    report && report.totalEntries > 0
      ? Math.round((report.totalRead / report.totalEntries) * 100)
      : 0;

  // 获取报告类型配置
  const typeConfig = report
    ? reportTypeConfig[report.reportType as keyof typeof reportTypeConfig]
    : reportTypeConfig.daily;
  const TypeIcon = typeConfig.icon;

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside
            className={cn(
              'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
              isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
            )}
          >
            <AppSidebar />
          </aside>
          <main className="flex-1 overflow-y-auto bg-background/30">
            <div className="max-w-4xl mx-auto px-6 py-8">
              <ReportDetailSkeleton />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside
            className={cn(
              'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
              isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
            )}
          >
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="报告不存在"
              description="您访问的报告可能已被删除或不存在"
              action={{
                label: '返回报告列表',
                onClick: () => router.push('/reports'),
              }}
            />
          </main>
        </div>
      </div>
    );
  }

  // 检查是否是生成中状态
  const isGenerating = report.status === 'generating' || report.status === 'pending';
  const isFailed = report.status === 'failed';

  // 获取主题数据并计算最大值
  const topics = (report.topics as any)?.topTopics || [];
  const maxTopicCount = topics.length > 0 ? Math.max(...topics.map((t: any) => t.count)) : 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
          )}
        >
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* 返回按钮 */}
            <Fade in={isPageLoaded} direction="left" distance={15} duration={400}>
              <Button
                type="text"
                icon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => router.back()}
                className="mb-4 hover:bg-muted/30 transition-all duration-300 hover:translate-x-[-4px]"
              >
                返回
              </Button>
            </Fade>

            {/* 生成中状态 */}
            {(isGenerating || isFailed) && progressData && (
              <Fade in direction="up" distance={20} duration={500}>
                <GeneratingState
                  progress={progressData.progress}
                  currentStep={progressData.currentStep}
                  steps={progressData.steps || []}
                  errorMessage={isFailed ? report.errorMessage || undefined : undefined}
                  onCancel={handleCancel}
                />
              </Fade>
            )}

            {/* 头部 */}
            {!isGenerating && (
              <Fade in={isPageLoaded} direction="up" distance={20} duration={500} delay={100}>
                <Card
                  className={cn(
                    'mb-6 border-border/60 overflow-hidden relative',
                    'bg-gradient-to-br',
                    typeConfig.gradient
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={cn(
                            'w-14 h-14 rounded-2xl flex items-center justify-center',
                            typeConfig.bgColor,
                            typeConfig.borderColor,
                            'border-2'
                          )}
                        >
                          <TypeIcon className={cn('h-7 w-7', typeConfig.textColor)} />
                        </div>
                        <div>
                          <Title level={2} className="!mb-0 !text-2xl">
                            {report.title}
                          </Title>
                          <Text type="secondary" className="text-sm">
                            生成于 {format(new Date(report.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                          </Text>
                        </div>
                        {report.aiGenerated && (
                          <StatusBadge status="processing" pulse className="ml-2">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI 生成
                          </StatusBadge>
                        )}
                      </div>
                      <Paragraph className="text-muted-foreground !mb-0 max-w-2xl">
                        {report.summary || '暂无摘要'}
                      </Paragraph>
                    </div>

                    <Space className="flex-shrink-0">
                      <Select
                        value={selectedFormat}
                        onChange={(value) => setSelectedFormat(value as any)}
                        className="w-32"
                        dropdownStyle={{ animation: 'fadeIn 0.2s' }}
                      >
                        <Select.Option value="markdown">Markdown</Select.Option>
                        <Select.Option value="html">HTML</Select.Option>
                        <Select.Option value="json">JSON</Select.Option>
                      </Select>
                      <Button
                        onClick={handleDownload}
                        icon={<Download className="h-4 w-4" />}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        下载
                      </Button>
                      <Button
                        onClick={handleShare}
                        icon={<Share2 className="h-4 w-4" />}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        分享
                      </Button>
                      <Button
                        danger
                        onClick={handleDelete}
                        icon={<Trash2 className="h-4 w-4" />}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        删除
                      </Button>
                    </Space>
                  </div>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      value={report.totalEntries}
                      label="新增文章"
                      icon={<FileText className="h-5 w-5" />}
                      color={report.reportType === 'daily' ? 'blue' : 'purple'}
                      delay={0}
                    />
                    <StatCard
                      value={report.totalRead}
                      label="已阅读"
                      icon={<CheckCircle2 className="h-5 w-5" />}
                      color="green"
                      delay={50}
                    />
                    <StatCard
                      value={report.totalFeeds}
                      label="订阅源"
                      icon={<BookOpen className="h-5 w-5" />}
                      color="orange"
                      delay={100}
                    />
                    <StatCard
                      value={readRate}
                      suffix="%"
                      label="阅读率"
                      icon={<BarChart3 className="h-5 w-5" />}
                      color={readRate >= 50 ? 'green' : readRate >= 20 ? 'orange' : 'blue'}
                      delay={150}
                    />
                  </div>
                </Card>
              </Fade>
            )}

            {/* 报告内容 - 只在生成完成时显示 */}
            {report.status === 'completed' && (
              <Fade in={isPageLoaded} direction="up" distance={20} duration={500} delay={200}>
                <Card
                  className="mb-6 border-border/60 overflow-hidden"
                  title={
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span>报告内容</span>
                    </div>
                  }
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 text-foreground/90">
                      {report.content || '暂无内容'}
                    </pre>
                  </div>
                </Card>
              </Fade>
            )}

            {/* 主题分析 - 只在生成完成时显示 */}
            {report.status === 'completed' && topics.length > 0 && (
              <Fade in={isPageLoaded} direction="up" distance={20} duration={500} delay={300}>
                <Card
                  className="mb-6 border-border/60"
                  title={
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      <span>主题分析</span>
                      <Tag color="default" className="ml-2">
                        {topics.length} 个主题
                      </Tag>
                    </div>
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {topics.slice(0, 8).map((topic: any, index: number) => (
                      <TopicTag
                        key={index}
                        topic={topic.topic}
                        count={topic.count}
                        maxCount={maxTopicCount}
                        index={index}
                      />
                    ))}
                  </div>
                </Card>
              </Fade>
            )}

            {/* 精选文章 - 只在生成完成时显示 */}
            {report.status === 'completed' && report.entries && report.entries.length > 0 && (
              <Fade in={isPageLoaded} direction="up" distance={20} duration={500} delay={400}>
                <Card
                  className="border-border/60"
                  title={
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                      <span>相关文章</span>
                      <Tag color="default" className="ml-2">
                        {Math.min(report.entries.length, 10)} 篇
                      </Tag>
                    </div>
                  }
                >
                  <StaggerContainer staggerDelay={50} initialDelay={100}>
                    <div className="space-y-2">
                      {report.entries.slice(0, 10).map((entry: any, index: number) => (
                        <EntryItem key={entry.id} entry={entry} index={index} />
                      ))}
                    </div>
                  </StaggerContainer>
                </Card>
              </Fade>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
