/**
 * 报告列表页面
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
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly'>('all');

  const { data: reportsData, isLoading } = trpc.reports.list.useQuery({
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
      window.location.reload();
    } catch (error) {
      console.error('生成报告失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此报告吗？')) return;
    try {
      await deleteReport.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-5xl">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">报告中心</h1>
          <p className="text-muted-foreground">查看日报、周报和阅读分析</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerate('daily')}
            disabled={generateDaily.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            生成日报
          </button>
          <button
            onClick={() => handleGenerate('weekly')}
            disabled={generateWeekly.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            生成周报
          </button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-2 rounded-lg transition-colors',
            filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          全部
        </button>
        <button
          onClick={() => setFilter('daily')}
          className={cn(
            'px-4 py-2 rounded-lg transition-colors',
            filter === 'daily' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          日报
        </button>
        <button
          onClick={() => setFilter('weekly')}
          className={cn(
            'px-4 py-2 rounded-lg transition-colors',
            filter === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          周报
        </button>
      </div>

      {/* 报告列表 */}
      {!reports || reports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无报告</h3>
          <p className="text-muted-foreground mb-6">生成您的第一份报告来查看阅读统计</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleGenerate('daily')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              生成日报
            </button>
            <button
              onClick={() => handleGenerate('weekly')}
              className="px-6 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              生成周报
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow"
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
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-full text-xs">
                        AI 生成
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {report.summary}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  </div>
                </Link>

                <div className="flex items-center gap-1 ml-4">
                  <button
                    className="p-2 hover:bg-secondary rounded-md transition-colors"
                    title="下载"
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    className="p-2 hover:bg-secondary rounded-md transition-colors"
                    title="分享"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-600 rounded-md transition-colors"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 高亮内容 */}
              {report.highlights && report.highlights.length > 0 && (
                <div className="mt-4 pt-4 border-t">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
