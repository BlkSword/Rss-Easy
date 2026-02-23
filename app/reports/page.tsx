/**
 * 报告列表页面 - 全屏布局
 * 优化版：支持异步生成，显示生成中状态
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  FileText,
  Calendar,
  Plus,
  Download,
  Share2,
  Trash2,
  MoreHorizontal,
  BarChart3,
  BookOpen,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  X,
  Mail,
  Settings,
  Brain,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button, Card as AntCard, Tag, Space, Modal, Dropdown, Progress, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { handleApiSuccess, handleApiError, notifySuccess, notifyError } from '@/lib/feedback';
import { Card } from '@/components/ui/card';

// 动画组件
import { Fade, StaggerContainer, ListItemFade, HoverLift } from '@/components/animation/fade';
import { AnimatedCounter } from '@/components/animation/animated-counter';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

// Hooks
import { usePageLoadAnimation } from '@/hooks/use-animation';

// Components
import { ReportScheduleSettings } from './components/report-schedule-settings';

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
      <BarChart3 className="h-5 w-5 text-purple-500" />
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
      <Card isHoverable>
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
        <AntCard key={i} className="border-border/60">
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
        </AntCard>
      ))}
    </div>
  );
}

// 配置状态卡片
function ConfigStatusCard({
  type,
  isConfigured,
  onConfigure,
}: {
  type: 'ai' | 'email';
  isConfigured: boolean;
  onConfigure: () => void;
}) {
  const isAI = type === 'ai';
  const title = isAI ? 'AI 服务' : '邮件服务';
  const icon = isAI ? <Brain className="h-5 w-5" /> : <Mail className="h-5 w-5" />;
  const description = isAI
    ? '生成报告需要配置 AI 服务'
    : '发送报告邮件需要配置邮件服务';

  return (
    <Fade direction="up" distance={10}>
      <Card
        className={cn(
          'border-2 transition-all duration-300',
          isConfigured
            ? 'border-green-200 bg-green-50/30 hover:border-green-300'
            : 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                isConfigured
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-amber-500/10 text-amber-600'
              )}
            >
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{title}</span>
                {isConfigured ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isConfigured ? '已配置' : description}
              </p>
            </div>
          </div>
          {!isConfigured && (
            <Button
              type="primary"
              size="small"
              onClick={onConfigure}
              icon={<Settings className="h-3.5 w-3.5" />}
            >
              去配置
            </Button>
          )}
        </div>
      </Card>
    </Fade>
  );
}

// 生成中报告卡片
function GeneratingReportCard({
  report,
  onCancel,
}: {
  report: any;
  onCancel: (id: string) => void;
}) {
  return (
    <ListItemFade index={0} baseDelay={80}>
      <Card className="border-border/60 border-dashed border-2 bg-muted/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center animate-pulse">
            <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground/70">{report.title}</h3>
              <Tag color="processing" icon={<Loader2 className="animate-spin" />}>
                生成中
              </Tag>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">{report.currentStep || '准备中...'}</span>
                <span className="text-primary font-medium">{report.progress || 0}%</span>
              </div>
              <Progress
                percent={report.progress || 0}
                size="small"
                strokeColor="#ea580c"
                showInfo={false}
              />
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(report.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </span>
            </div>
          </div>

          <Tooltip title="取消生成">
            <Button
              type="text"
              icon={<X className="h-4 w-4" />}
              onClick={() => onCancel(report.id)}
            />
          </Tooltip>
        </div>
      </Card>
    </ListItemFade>
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
  getActionItems: (id: string, isCompleted: boolean) => MenuProps['items'];
}) {
  // 生成中的报告使用特殊卡片
  if (report.status === 'generating' || report.status === 'pending') {
    return <GeneratingReportCard report={report} onCancel={onDelete} />;
  }

  // 生成失败的报告
  if (report.status === 'failed') {
    return (
      <ListItemFade index={index} baseDelay={80}>
        <Card className="border-red-200 bg-red-50/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h3 className="text-lg font-semibold text-foreground/70">{report.title}</h3>
                <Tag color="error">生成失败</Tag>
              </div>
              <p className="text-sm text-red-600/80 mb-2">{report.errorMessage || '未知错误'}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(report.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
            </div>
            <Button
              type="text"
              danger
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => onDelete(report.id)}
            >
              删除
            </Button>
          </div>
        </Card>
      </ListItemFade>
    );
  }

  // 正常完成的报告
  return (
    <ListItemFade index={index} baseDelay={80}>
      <HoverLift lift={4} shadow={false}>
        <Card isClickable>
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
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI 生成
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {report.summary || '暂无摘要'}
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
              <Dropdown menu={{ items: getActionItems(report.id, report.status === 'completed') }} trigger={['click']}>
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
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 页面加载动画
  const isPageLoaded = usePageLoadAnimation(100);

  const { data: reportsData, isLoading, refetch } = trpc.reports.list.useQuery({});

  const reports = reportsData?.items;

  // 轮询生成中的报告
  useEffect(() => {
    if (!reports) return;

    const pendingReports = reports.filter(
      r => r.status === 'generating' || r.status === 'pending'
    );

    if (pendingReports.length === 0) return;

    // 更新生成中ID集合
    setGeneratingIds(new Set(pendingReports.map(r => r.id)));

    // 每3秒刷新一次
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [reports, refetch]);

  // 计算统计数据
  const stats = {
    total: reports?.filter(r => r.status === 'completed').length || 0,
    totalEntries: reports?.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.totalEntries, 0) || 0,
    generating: reports?.filter(r => r.status === 'generating' || r.status === 'pending').length || 0,
  };

  const startGenerateDaily = trpc.reports.startGenerateDaily.useMutation();
  const cancelGeneration = trpc.reports.cancelGeneration.useMutation();
  const deleteReport = trpc.reports.delete.useMutation();
  const sendByEmail = trpc.reports.sendByEmail.useMutation();
  const { data: emailConfig } = trpc.reports.checkEmailConfig.useQuery();
  const { data: aiConfigStatus, refetch: refetchAIConfig } = trpc.reports.checkAIConfig.useQuery(undefined, {
    enabled: true,
  });
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  // 检查配置状态
  const isAIConfigured = aiConfigStatus?.success ?? false;
  const isEmailConfigured = emailConfig?.enabled && emailConfig?.configured;

  const handleGenerate = async () => {
    const date = new Date();

    // 1. 先检查AI配置
    const configResult = await refetchAIConfig();
    if (configResult.data && !configResult.data.success) {
      Modal.confirm({
        title: 'AI服务未配置',
        content: configResult.data.error || '生成报告需要配置AI服务。是否前往设置页面配置？',
        okText: '前往设置',
        cancelText: '取消',
        onOk: () => {
          window.location.href = '/settings?tab=ai';
        },
      });
      return;
    }

    try {
      // 2. 启动异步生成（使用日报接口，但概念上只是"生成报告"）
      await startGenerateDaily.mutateAsync({ reportDate: date });

      notifySuccess('已开始生成报告', '请稍候，报告生成完成后会自动刷新');
      refetch();
    } catch (error: any) {
      handleApiError(error, '启动生成失败');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelGeneration.mutateAsync({ id });
      notifySuccess('已取消生成');
      refetch();
    } catch (error) {
      handleApiError(error, '取消失败');
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

  const handleSendByEmail = async (id: string) => {
    // 检查邮件配置
    if (!emailConfig?.enabled || !emailConfig?.configured) {
      Modal.confirm({
        title: '邮件服务未配置',
        content: '您需要先配置邮件服务才能发送报告到邮箱。是否前往设置页面？',
        okText: '前往设置',
        cancelText: '取消',
        onOk: () => {
          window.location.href = '/settings?tab=email';
        },
      });
      return;
    }

    setSendingEmailId(id);
    try {
      const result = await sendByEmail.mutateAsync({ id });
      if (result.success) {
        notifySuccess('邮件发送成功', `报告已发送至 ${emailConfig.email}`);
      } else {
        notifyError(result.message, '请检查邮件配置是否正确');
      }
    } catch (error: any) {
      handleApiError(error, '发送邮件失败');
    } finally {
      setSendingEmailId(null);
    }
  };

  const getActionItems = (reportId: string, isCompleted: boolean): MenuProps['items'] => {
    const items: MenuProps['items'] = [
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
    ];

    // 只有已完成的报告才能发送邮件
    if (isCompleted) {
      items.push({
        key: 'email',
        icon: sendingEmailId === reportId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />,
        label: sendingEmailId === reportId ? '发送中...' : '发送到邮箱',
        disabled: sendingEmailId === reportId || !emailConfig?.enabled,
        onClick: () => handleSendByEmail(reportId),
      });
    }

    items.push({
      type: 'divider',
    });

    items.push({
      key: 'delete',
      icon: <Trash2 className="h-4 w-4" />,
      label: '删除',
      danger: true,
      onClick: () => handleDelete(reportId),
    });

    return items;
  };

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
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 头部 */}
            <Fade in={isPageLoaded} direction="up" distance={20} duration={500}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold">报告中心</h1>
                  <p className="text-muted-foreground">查看和管理您的阅读报告</p>
                </div>
                <Space>
                  <Tooltip title="定时任务设置">
                    <Button
                      icon={<Clock className="h-4 w-4" />}
                      onClick={() => setSettingsOpen(true)}
                    >
                      定时任务
                    </Button>
                  </Tooltip>
                  <Button
                    type="primary"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={handleGenerate}
                    className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
                  >
                    生成报告
                  </Button>
                </Space>
              </div>
            </Fade>

            {/* 配置状态提示 - 当配置不完整时显示 */}
            {!isLoading && (!isAIConfigured || !isEmailConfigured) && (
              <Fade delay={100} direction="up" distance={15}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {!isAIConfigured && (
                    <ConfigStatusCard
                      type="ai"
                      isConfigured={false}
                      onConfigure={() => window.location.href = '/settings?tab=ai'}
                    />
                  )}
                  {!isEmailConfigured && (
                    <ConfigStatusCard
                      type="email"
                      isConfigured={false}
                      onConfigure={() => window.location.href = '/settings?tab=email'}
                    />
                  )}
                </div>
              </Fade>
            )}

            {/* 统计概览 */}
            {!isLoading && reports && reports.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard
                  value={stats.total}
                  label="总报告数"
                  icon={<FileText className="h-5 w-5 text-blue-500" />}
                  delay={100}
                />
                <StatCard
                  value={stats.totalEntries}
                  label="累计文章"
                  icon={<BookOpen className="h-5 w-5 text-green-500" />}
                  delay={200}
                />
                {stats.generating > 0 && (
                  <StatCard
                    value={stats.generating}
                    label="生成中"
                    icon={<Loader2 className="h-5 w-5 text-amber-500 animate-spin" />}
                    delay={300}
                  />
                )}
              </div>
            )}

            {/* 报告列表 */}
            {isLoading ? (
              <ReportsListSkeleton />
            ) : !reports || reports.length === 0 ? (
              <Fade delay={300} direction="up" distance={20}>
                <EmptyState
                  icon={<FileText className="h-10 w-10" />}
                  title="暂无报告"
                  description="生成您的第一份报告来查看阅读统计和分析"
                  action={{
                    label: '生成报告',
                    onClick: handleGenerate,
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
                      onDelete={report.status === 'generating' || report.status === 'pending' ? handleCancel : handleDelete}
                      getActionItems={getActionItems}
                    />
                  ))}
                </div>
              </StaggerContainer>
            )}
          </div>
        </main>
      </div>

      {/* 定时任务设置弹窗 */}
      <ReportScheduleSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
