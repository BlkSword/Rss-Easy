'use client';

/**
 * 个性化推荐流组件
 *
 * 基于用户偏好展示个性化推荐文章
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/trpc/react';
import { Sparkles, TrendingUp, Clock } from 'lucide-react';
import { useState } from 'react';

interface PersonalizedFeedProps {
  limit?: number;
}

export function PersonalizedFeed({ limit = 20 }: PersonalizedFeedProps) {
  const [cursor, setCursor] = useState<string | undefined>();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
  } = api.analytics.getPersonalizedFeed.useInfiniteQuery(
    { limit, filters: { minScore: 6 } },
    {
      getNextPageParam: lastPage => lastPage.pagination.nextCursor,
    }
  );

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  const entries = data?.pages.flatMap(page => page.items) ?? [];

  if (entries.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">开始你的阅读之旅</h3>
            <p className="text-sm text-muted-foreground">
              阅读几篇文章后，我们就能为你提供个性化推荐
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            为你推荐
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            基于 AI 和你的阅读偏好
          </p>
        </div>
        {data?.pages[0]?.personalized && (
          <Badge variant="default" className="text-xs">
            已个性化
          </Badge>
        )}
      </div>

      {/* 文章列表 */}
      <div className="space-y-3">
        {entries.map((entry: any) => (
          <PersonalizedEntryCard
            key={entry.id}
            entry={entry}
          />
        ))}
      </div>

      {/* 加载更多 */}
      {hasNextPage && (
        <Button
          onClick={() => fetchNextPage()}
          disabled={isFetching}
          variant="outline"
          className="w-full"
        >
          {isFetching ? (
            <>
              <LoadingSpinner size="sm" />
              加载中...
            </>
          ) : (
            '加载更多推荐'
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * 个性化文章卡片
 */
function PersonalizedEntryCard({ entry }: { entry: any }) {
  const { mutate: toggleRead } = api.entries.toggleRead.useMutation();

  const scoreDimensions = entry.aiScoreDimensions as any;
  const personalScore = entry.personalScore;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* 评分指示器 */}
        {personalScore && (
          <div className="flex-shrink-0">
            <ScoreGauge score={personalScore} size="sm" />
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold line-clamp-2 hover:text-primary cursor-pointer">
            {entry.title}
          </h3>

          {entry.oneLineSummary && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {entry.oneLineSummary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* 来源 */}
            <span className="text-xs text-muted-foreground">
              {entry.feed.title}
            </span>

            {/* 发布时间 */}
            <span className="text-xs text-muted-foreground">
              {entry.publishedAt && formatTimeAgo(new Date(entry.publishedAt))}
            </span>

            {/* 维度标签 */}
            {scoreDimensions && (
              <>
                {scoreDimensions.depth >= 8 && (
                  <Badge variant="secondary" className="text-xs">深度</Badge>
                )}
                {scoreDimensions.practicality >= 7 && (
                  <Badge variant="secondary" className="text-xs">实用</Badge>
                )}
              </>
            )}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex-shrink-0">
          <button
            onClick={() => entry.id && toggleRead({ entryId: entry.id })}
            className="p-2 hover:bg-muted rounded"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

/**
 * 评分仪表盘组件
 */
function ScoreGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  const textSize = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div className={`relative ${sizeClass}`}>
      <svg className={`h-full w-full -rotate-90`} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted opacity-20"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={`${(score / 10) * 251} 251`}
          strokeLinecap="round"
          className={score >= 8 ? 'text-green-500' : score >= 6 ? 'text-yellow-500' : 'text-orange-500'}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center ${textSize} font-bold`}>
        {score.toFixed(1)}
      </div>
    </div>
  );
}

/**
 * 格式化时间差
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;

  return date.toLocaleDateString();
}
