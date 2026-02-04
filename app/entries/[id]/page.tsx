/**
 * 文章详情页面
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Star,
  StarOff,
  Archive,
  ExternalLink,
  Sparkles,
  Copy,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

export default function EntryPage() {
  const params = useParams();
  const router = useRouter();
  const entryId = params.id as string;

  const { data: entry, isLoading } = trpc.entries.byId.useQuery({ id: entryId });
  const analyzeMutation = trpc.entries.analyze.useMutation();
  const markAsStarred = trpc.entries.markAsStarred.useMutation();

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (isLoading) {
    return (
      <div className="container py-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="container py-6 text-center text-muted-foreground">
        文章不存在
      </div>
    );
  }

  const handleAnalyze = async (type: 'summary' | 'all') => {
    setIsAnalyzing(true);
    try {
      await analyzeMutation.mutateAsync({
        entryId: entry.id,
        analysisType: type,
      });
      // 刷新页面数据
      router.refresh();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleStar = async () => {
    await markAsStarred.mutateAsync({
      entryIds: [entry.id],
      starred: !entry.isStarred,
    });
    router.refresh();
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

      {/* 文章头部 */}
      <article className="bg-card border rounded-lg overflow-hidden">
        {/* 操作栏 */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {entry.feed.iconUrl && (
                <img src={entry.feed.iconUrl} alt="" className="w-4 h-4 rounded" />
              )}
              {entry.feed.title}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(entry.publishedAt || entry.createdAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStar}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title={entry.isStarred ? '取消星标' : '添加星标'}
            >
              {entry.isStarred ? (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="在新窗口打开"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="px-6 pt-6 pb-4 text-2xl font-bold">{entry.title}</h1>

        {/* AI 摘要 */}
        {entry.aiSummary && (
          <div className="px-6 pb-4">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium mb-2">
                <Sparkles className="h-4 w-4" />
                AI 摘要
              </div>
              <p className="text-sm">{entry.aiSummary}</p>
            </div>
          </div>
        )}

        {/* 如果没有 AI 摘要，显示分析按钮 */}
        {!entry.aiSummary && (
          <div className="px-6 pb-4">
            <button
              onClick={() => handleAnalyze('summary')}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isAnalyzing ? '生成中...' : '生成 AI 摘要'}
            </button>
          </div>
        )}

        {/* 正文内容 */}
        <div className="px-6 pb-6">
          {entry.summary && !entry.content && (
            <p className="text-muted-foreground leading-relaxed">{entry.summary}</p>
          )}
          {entry.content && (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: entry.content }}
            />
          )}
        </div>

        {/* AI 分析信息 */}
        {(entry.aiKeywords?.length || entry.aiCategory || entry.aiSentiment) && (
          <div className="px-6 py-4 border-t bg-muted/30">
            <h3 className="text-sm font-medium mb-3">AI 分析</h3>
            <div className="flex flex-wrap gap-2">
              {entry.aiCategory && (
                <span className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-sm">
                  分类: {entry.aiCategory}
                </span>
              )}
              {entry.aiSentiment && (
                <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-sm">
                  情感: {entry.aiSentiment}
                </span>
              )}
              {entry.aiImportanceScore && entry.aiImportanceScore > 0.7 && (
                <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-sm">
                  重要性: {(entry.aiImportanceScore * 100).toFixed(0)}%
                </span>
              )}
              {entry.aiKeywords?.map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* 相关文章 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">相关文章</h2>
        <div className="text-center text-muted-foreground py-8">
          相关文章推荐功能开发中...
        </div>
      </div>
    </div>
  );
}
