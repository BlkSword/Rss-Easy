/**
 * 报告列表页面 - 全屏布局
 * 增强版：添加动画效果和交互优化
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  FileText,
  Calendar,
  TrendingUp,
  Plus,
  Download,
  Share2,
  Trash2,
  MoreHorizontal,
  BarChart3,
  BookOpen,
  Clock,
} from 'lucide-react';
import { Button, Card, Tag, Space, Modal, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';

// 动画组件
import { Fade, StaggerContainer, ListItemFade, HoverLift } from '@/components/animation/fade';
import { AnimatedCounter } from '@/components/animation/animated-counter';
import { LoadingOverlay, Spinner } from '@/components/animation/loading';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

// Hooks
import { usePageLoadAnimation } from '@/hooks/use-animation';

// 报告类型图标组件
function ReportTypeIcon({ type }: { type: string }) {
  if (type === 'daily') {
    return (
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
        <Calendar className="h-5 w-5 text-blue-500" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
      <TrendingUp className="h-5 w-5 text-purple-500" />
    </div>
  );
}

// 统计概览卡片
function StatCard({
  value,
  label,
  icon,
  delay = 0,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <Fade delay={delay} direction="up" distance={15}>
      <Card className="border-border/60 hover:border-primary/30 transition-all duration-300 hover:shadow-md">
        <AnimatedCounter value={value} label={label} icon={icon} duration={1200} />
      </Card>
    </Fade>
  );
}

// 报告列表骨架屏
function ReportsListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-border/60">
          <div className="flex items-start gap-4">
            <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// 过滤器按钮
function FilterButton({
  active,
  onClick,
  children,
  delay = 0,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Fade delay={delay} direction="up" distance={10}>
      <button
        onClick={onClick}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
          'relative overflow-hidden group',
          active
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
            : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
        )}
      >
        <span className="relative z-10 flex items-center gap-2">{children}</span>
        {active && (
          <span className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
      </button>
    </Fade>
  );
}

// 报告卡片
function ReportCard({
  report,
  index,
  onDelete,
  getActionItems,
}: {
  report: any;
  index: number;
  onDelete: (id: string) => void;
  getActionItems: (id: string) => MenuProps['items'];
}) {
  return (
    <ListItemFade index={index} baseDelay={80}>
      <HoverLift lift={4} shadow={false}>
        <Card className="border-border/60 hover:border-primary/30 transition-all duration-300 hover:shadow-lg cursor-pointer group">
          <div className="flex items-start justify-between">
            <Link href={`/reports/${report.id}`} className="flex-1 min-w-0">
              <div className="flex items-start gap-4">
                <ReportTypeIcon type={report.reportType} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                      {report.title}
                    </h3>
                    {report.aiGenerated && (
                      <StatusBadge status="processing" pulse>
                        AI 生成
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {report.summary}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDistanceToNow(new Date(report.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {report.totalEntries} 篇文章
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      已读 {report.totalRead} 篇
                    </span>
                    {report.totalEntries > 0 && (
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5" />
                        阅读率 {Math.round((report.totalRead / report.totalEntries) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Dropdown menu={{ items: getActionItems(report.id) }} trigger={['click']}>
                <Button type="text" icon={<MoreHorizontal className="h-4 w-4" />} />
              </Dropdown>
            </div>
          </div>

          {/* 高亮内容 */}
          {report.highlights && report.highlights.length > 0 && (
            <Fade delay={200} direction="up" distance={8}>
              <div className="mt-4 pt-4 border-t border-border/60">
                <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  精选内容
                </div>
                <ul className="space-y-2">
                  {report.highlights.slice(0, 3).map((highlight: string, idx: number) => (
                    <li
                      key={idx}
                      className="text-sm flex items-start gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="text-primary mt-1">•</span>
                      <span className="line-clamp-1">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Fade>
          )}
        </Card>
      </HoverLift>
    </ListItemFade>
  );
}

export default function ReportsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly'>('all');

  // 页面加载动画
  const isPageLoaded = usePageLoadAnimation(100);

  const { data: reportsData, isLoading, refetch } = trpc.reports.list.useQuery({
    reportType: filter === 'all' ? undefined : filter,
  });

  const reports = reportsData?.items;

  // 计算统计数据
  const stats = {
    total: reports?.length || 0,
    daily: reports?.filter((r) => r.reportType === 'daily').length || 0,
    weekly: reports?.filter((r) => r.reportType === 'weekly').length || 0,
    totalEntries: reports?.reduce((sum, r) => sum + r.totalEntries, 0) || 0,
  };

  const generateDaily = trpc.reports.generateDaily.useMutation();
  const generateWeekly = trpc.reports.generateWeekly.useMutation();
  const deleteReport = trpc.reports.delete.useMutation();

  const isGenerating = generateDaily.isPending || generateWeekly.isPending;

  const handleGenerate = async (type: 'daily' | 'weekly') => {
    const date = new Date();
    try {
      if (type === 'daily') {
        await generateDaily.mutateAsync({ reportDate: date });
      } else {
        await generateWeekly.mutateAsync({ reportDate: date });
      }
      handleApiSuccess('报告生成成功');
      refetch();
    } catch (error) {
      handleApiError(error, '生成报告失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此报告吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteReport.mutateAsync({ id });
          handleApiSuccess('删除成功');
          refetch();
        } catch (error) {
          handleApiError(error, '删除失败');
        }
      },
    });
  };

  const getActionItems = (reportId: string): MenuProps['items'] => [
    {
      key: 'download',
      icon: <Download className="h-4 w-4" />,
      label: '下载',
    },
    {
      key: 'share',
      icon: <Share2 className="h-4 w-4" />,
      label: '分享',
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <Trash2 className="h-4 w-4" />,
      label: '删除',
      danger: true,
      onClick: () => handleDelete(reportId),
    },
  ];

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
        <main className="flex-1 overflow-y-auto bg-background/30 relative">
          {/* 生成报告加载遮罩 */}
          {isGenerating && (
            <div className="fixed inset-0 bg-background/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
              <div className="bg-card border border-border/60 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                <div className="relative">
                  <Spinner size="lg" variant="primary" />
                  <div className="absolute inset-0 animate-ping opacity-20">
                    <Spinner size="lg" variant="primary" />
                  </div>
                </div>
                <p className="text-lg font-medium">正在生成报告...</p>
                <p className="text-sm text-muted-foreground">AI 正在分析您的阅读数据</p>
              </div>
            </div>
          )}

          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 头部 */}
            <Fade in={isPageLoaded} direction="up" distance={20} duration={500}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold">报告中心</h1>
                  <p className="text-muted-foreground">查看日报、周报和阅读分析</p>
                </div>
                <Space>
                  <Button
                    type="primary"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => handleGenerate('daily')}
                    loading={generateDaily.isPending}
                    className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
                  >
                    生成日报
                  </Button>
                  <Button
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => handleGenerate('weekly')}
                    loading={generateWeekly.isPending}
                  >
                    生成周报
                  </Button>
                </Space>
              </div>
            </Fade>

            {/* 统计概览 */}
            {!isLoading && reports && reports.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                  value={stats.total}
                  label="总报告数"
                  icon={<FileText className="h-5 w-5 text-blue-500" />}
                  delay={100}
                />
                <StatCard
                  value={stats.daily}
                  label="日报"
                  icon={<Calendar className="h-5 w-5 text-blue-500" />}
                  delay={200}
                />
                <StatCard
                  value={stats.weekly}
                  label="周报"
                  icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
                  delay={300}
                />
                <StatCard
                  value={stats.totalEntries}
                  label="累计文章"
                  icon={<BookOpen className="h-5 w-5 text-green-500" />}
                  delay={400}
                />
              </div>
            )}

            {/* 过滤器 */}
            <div className="flex items-center gap-2 mb-6">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} delay={150}>
                全部
              </FilterButton>
              <FilterButton
                active={filter === 'daily'}
                onClick={() => setFilter('daily')}
                delay={200}
              >
                <Calendar className="h-3.5 w-3.5" />
                日报
              </FilterButton>
              <FilterButton
                active={filter === 'weekly'}
                onClick={() => setFilter('weekly')}
                delay={250}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                周报
              </FilterButton>
            </div>

            {/* 报告列表 */}
            <LoadingOverlay isLoading={isLoading && !isGenerating}>
              {!reports || reports.length === 0 ? (
                <Fade delay={300} direction="up" distance={20}>
                  <EmptyState
                    icon={<FileText className="h-10 w-10" />}
                    title="暂无报告"
                    description="生成您的第一份报告来查看阅读统计和分析"
                    action={{
                      label: '生成日报',
                      onClick: () => handleGenerate('daily'),
                    }}
                    secondaryAction={{
                      label: '生成周报',
                      onClick: () => handleGenerate('weekly'),
                    }}
                    variant="card"
                  />
                </Fade>
              ) : (
                <StaggerContainer staggerDelay={80} initialDelay={200}>
                  <div className="space-y-4">
                    {reports.map((report, index) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        index={index}
                        onDelete={handleDelete}
                        getActionItems={getActionItems}
                      />
                    ))}
                  </div>
                </StaggerContainer>
              )}
            </LoadingOverlay>
          </div>
        </main>
      </div>
    </div>
  );
}
