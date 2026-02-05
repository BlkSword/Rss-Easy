/**
 * 报告列表页面 - 全屏布局
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
} from 'lucide-react';
import { Button, Card, Tag, Space, Empty, Spin, Modal, message, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { useSidebar } from '@/components/providers/sidebar-provider';

export default function ReportsPage() {
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly'>('all');
  const { isCollapsed, toggleSidebar } = useSidebar();

  const { data: reportsData, isLoading, refetch } = trpc.reports.list.useQuery({
    reportType: filter === 'all' ? undefined : filter,
  });

  const reports = reportsData?.items;

  const generateDaily = trpc.reports.generateDaily.useMutation();
  const generateWeekly = trpc.reports.generateWeekly.useMutation();
  const deleteReport = trpc.reports.delete.useMutation();

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isCollapsed ? 'hidden lg:hidden' : 'block'
        )}>
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 头部 */}
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

            {/* 过滤器 */}
            <div className="flex items-center gap-2 mb-6">
              <Button
                type={filter === 'all' ? 'primary' : 'default'}
                onClick={() => setFilter('all')}
              >
                全部
              </Button>
              <Button
                type={filter === 'daily' ? 'primary' : 'default'}
                onClick={() => setFilter('daily')}
              >
                日报
              </Button>
              <Button
                type={filter === 'weekly' ? 'primary' : 'default'}
                onClick={() => setFilter('weekly')}
              >
                周报
              </Button>
            </div>

            {/* 报告列表 */}
            {!reports || reports.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">生成您的第一份报告来查看阅读统计</p>
                    <Space>
                      <Button
                        type="primary"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => handleGenerate('daily')}
                      >
                        生成日报
                      </Button>
                      <Button
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => handleGenerate('weekly')}
                      >
                        生成周报
                      </Button>
                    </Space>
                  </div>
                }
              />
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <Card
                    key={report.id}
                    className="border-border/60 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/reports/${report.id}`}
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {report.reportType === 'daily' ? (
                            <Calendar className="h-5 w-5 text-blue-500" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-purple-500" />
                          )}
                          <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                            {report.title}
                          </h3>
                          {report.aiGenerated && (
                            <Tag color="purple">AI 生成</Tag>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {report.summary}
                        </p>
                        <Space className="text-sm text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(report.createdAt), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                          <span>·</span>
                          <span>{report.totalEntries} 篇文章</span>
                          <span>·</span>
                          <span>已读 {report.totalRead} 篇</span>
                        </Space>
                      </Link>

                      <div className="flex items-center gap-1 ml-4">
                        <Dropdown menu={{ items: getActionItems(report.id) }} trigger={['click']}>
                          <Button type="text" icon={<MoreHorizontal className="h-4 w-4" />} />
                        </Dropdown>
                      </div>
                    </div>

                    {/* 高亮内容 */}
                    {report.highlights && report.highlights.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/60">
                        <div className="text-sm text-muted-foreground mb-2">精选内容</div>
                        <ul className="space-y-1">
                          {report.highlights.slice(0, 3).map((highlight, index) => (
                            <li
                              key={index}
                              className="text-sm flex items-start gap-2"
                            >
                              <span className="text-primary">•</span>
                              <span className="line-clamp-1">{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
