/**
 * 报告详情页面 - 全屏布局
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { Button, Card, Row, Col, Statistic, Spin, Empty, Space, Modal, message, Select, Typography } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { useSidebar } from '@/components/providers/sidebar-provider';

const { Title, Text } = Typography;

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;
  const { isCollapsed, toggleSidebar } = useSidebar();

  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'html' | 'json'>('markdown');

  const { data: report, isLoading, refetch } = trpc.reports.byId.useQuery({ id: reportId });
  const deleteReport = trpc.reports.delete.useMutation();

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isCollapsed ? 'hidden lg:hidden' : 'block'
          )}>
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Spin size="large" />
          </main>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isCollapsed ? 'hidden lg:hidden' : 'block'
          )}>
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Empty description="报告不存在" />
          </main>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    const blob = new Blob([report.content || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('下载成功');
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      message.success('链接已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
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

            {/* 头部 */}
            <Card className="mb-6 border-border/60">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {report.reportType === 'daily' ? (
                      <Calendar className="h-6 w-6 text-blue-500" />
                    ) : (
                      <TrendingUp className="h-6 w-6 text-purple-500" />
                    )}
                    <Title level={2} className="mb-0">{report.title}</Title>
                    {report.aiGenerated && (
                      <span className="px-2 py-1 bg-purple-500/10 text-purple-600 rounded-full text-sm">
                        AI 生成
                      </span>
                    )}
                  </div>
                  <Text type="secondary">{report.summary}</Text>
                </div>

                <Space>
                  <Select
                    value={selectedFormat}
                    onChange={(value) => setSelectedFormat(value as any)}
                    className="w-32"
                  >
                    <Select.Option value="markdown">Markdown</Select.Option>
                    <Select.Option value="html">HTML</Select.Option>
                    <Select.Option value="json">JSON</Select.Option>
                  </Select>
                  <Button
                    onClick={handleDownload}
                    icon={<Download className="h-4 w-4" />}
                  >
                    下载
                  </Button>
                  <Button
                    onClick={handleShare}
                    icon={<Share2 className="h-4 w-4" />}
                  >
                    分享
                  </Button>
                  <Button
                    danger
                    onClick={handleDelete}
                    icon={<Trash2 className="h-4 w-4" />}
                  >
                    删除
                  </Button>
                </Space>
              </div>

              {/* 统计信息 */}
              <Row gutter={16}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="新增文章"
                    value={report.totalEntries}
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="已阅读"
                    value={report.totalRead}
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="订阅源"
                    value={report.totalFeeds}
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="阅读率"
                    value={report.totalEntries > 0
                      ? Math.round((report.totalRead / report.totalEntries) * 100)
                      : 0}
                    suffix="%"
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 报告内容 */}
            <Card className="mb-6 border-border/60" title={
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span>报告内容</span>
              </div>
            }>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0">
                  {report.content}
                </pre>
              </div>
            </Card>

            {/* 主题分析 */}
            {report.topics && (
              <Card className="mb-6 border-border/60" title={
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>主题分析</span>
                </div>
              }>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(report.topics as any).topTopics?.slice(0, 8).map((topic: any, index: number) => (
                    <div
                      key={index}
                      className="p-3 bg-muted/50 rounded-lg text-center"
                    >
                      <div className="font-medium text-sm truncate">{topic.topic}</div>
                      <div className="text-xs text-muted-foreground">{topic.count} 篇</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 精选文章 */}
            {report.entries && report.entries.length > 0 && (
              <Card className="border-border/60" title={
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span>相关文章</span>
                </div>
              }>
                <div className="space-y-3">
                  {report.entries.slice(0, 10).map((entry: any) => (
                    <a
                      key={entry.id}
                      href={`/entries/${entry.entryId}`}
                      className="block p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-sm line-clamp-1">{entry.entry?.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {entry.section === 'highlights' && '⭐ 精选 · '}
                        {entry.section === 'topic' && '📁 专题 · '}
                        {entry.section === 'recommendation' && '💡 推荐 · '}
                        排名 #{entry.rank}
                      </div>
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
