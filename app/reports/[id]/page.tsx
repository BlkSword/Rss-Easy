/**
 * 报告详情页面
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
import { trpc } from '@/lib/trpc/client';
import { EntryList } from '@/components/entries/entry-list';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'html' | 'json'>('markdown');

  const { data: report, isLoading } = trpc.reports.byId.useQuery({ id: reportId });
  const deleteReport = trpc.reports.delete.useMutation();

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container py-6 text-center text-muted-foreground">
        报告不存在
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
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除此报告吗？')) return;
    try {
      await deleteReport.mutateAsync({ id: reportId });
      router.push('/reports');
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  return (
    <div className="container py-6 max-w-4xl">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      {/* 头部 */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {report.reportType === 'daily' ? (
                <Calendar className="h-6 w-6 text-blue-500" />
              ) : (
                <TrendingUp className="h-6 w-6 text-purple-500" />
              )}
              <h1 className="text-2xl font-bold">{report.title}</h1>
              {report.aiGenerated && (
                <span className="px-2 py-1 bg-purple-500/10 text-purple-600 rounded-full text-sm">
                  AI 生成
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{report.summary}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as any)}
              className="px-3 py-2 bg-secondary rounded-md text-sm"
            >
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="下载"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleShare}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="分享"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-500/10 hover:text-red-600 rounded-md transition-colors"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{report.totalEntries}</div>
            <div className="text-xs text-muted-foreground">新增文章</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{report.totalRead}</div>
            <div className="text-xs text-muted-foreground">已阅读</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{report.totalFeeds}</div>
            <div className="text-xs text-muted-foreground">订阅源</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">
              {report.totalEntries > 0
                ? Math.round((report.totalRead / report.totalEntries) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">阅读率</div>
          </div>
        </div>
      </div>

      {/* 报告内容 */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-semibold">报告内容</h2>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {report.content}
          </pre>
        </div>
      </div>

      {/* 主题分析 */}
      {report.topics && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-lg font-semibold">主题分析</h2>
          </div>
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
        </div>
      )}

      {/* 精选文章 */}
      {report.entries && report.entries.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" />
            <h2 className="text-lg font-semibold">相关文章</h2>
          </div>
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
        </div>
      )}
    </div>
  );
}
