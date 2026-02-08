'use client';

/**
 * 深度分析展示组件
 *
 * 显示 AI 深度分析结果，包括：
 * - 评分仪表盘
 * - 一句话总结
 * - 主要观点
 * - 关键引用
 * - 标签云
 * - 分析元数据
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/trpc/react';
import { Sparkles, TrendingUp, Award, Clock, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface DeepAnalysisCardProps {
  entryId: string;
}

export function DeepAnalysisCard({ entryId }: DeepAnalysisCardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: analysis, isLoading, refetch } = api.entries.getDeepAnalysis.useQuery({
    entryId,
  });

  const { mutate: triggerAnalysis } = api.entries.triggerDeepAnalysis.useMutation({
    onSuccess: () => {
      // 开始轮询检查分析结果
      const interval = setInterval(() => {
        refetch().then(result => {
          if (result.data?.analyzedAt) {
            clearInterval(interval);
            setIsAnalyzing(false);
          }
        });
      }, 3000);
    },
  });

  // 骨架屏
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
        </div>
      </Card>
    );
  }

  // 没有分析结果
  if (!analysis) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Sparkles className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">暂无深度分析</h3>
            <p className="text-sm text-muted-foreground mt-1">
              点击下方按钮启动 AI 深度分析，获得更智能的文章解读
            </p>
          </div>
          <Button
            onClick={() => {
              setIsAnalyzing(true);
              triggerAnalysis({ entryId, priority: 5 });
            }}
            disabled={isAnalyzing}
            className="min-w-[200px]"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                开始深度分析
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            预计耗时 30-60 秒，请稍候...
          </p>
        </div>
      </Card>
    );
  }

  // 显示分析结果
  return (
    <Card className="p-6 space-y-6">
      {/* 头部：标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 深度分析
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            来自 {analysis.feedName}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* AI 评分仪表盘 */}
      <ScoreDashboard
        aiScore={analysis.aiScore}
        scoreDimensions={analysis.scoreDimensions}
      />

      {/* 一句话总结 */}
      {analysis.oneLineSummary && (
        <div className="border-l-4 border-primary bg-primary/5 pl-4 py-3">
          <p className="font-medium text-foreground">{analysis.oneLineSummary}</p>
        </div>
      )}

      {/* 详细摘要 */}
      {analysis.summary && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">文章摘要</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      )}

      {/* 主要观点 */}
      {analysis.mainPoints && Array.isArray(analysis.mainPoints) && analysis.mainPoints.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            主要观点 ({analysis.mainPoints.length})
          </h4>
          <ul className="space-y-2">
            {analysis.mainPoints.map((point: any, i: number) => (
              <li key={i} className="text-sm space-y-1">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                    (point.importance || 0.5) > 0.7 ? 'bg-green-500' :
                    (point.importance || 0.5) > 0.4 ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />
                  <span className="font-medium">{point.point}</span>
                </div>
                {point.explanation && (
                  <p className="ml-4 text-xs text-muted-foreground">{point.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 关键引用 */}
      {analysis.keyQuotes && Array.isArray(analysis.keyQuotes) && analysis.keyQuotes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Award className="h-4 w-4" />
            关键引用 ({analysis.keyQuotes.length})
          </h4>
          <div className="space-y-2">
            {analysis.keyQuotes.map((quote: any, i: number) => (
              <blockquote
                key={i}
                className="border-l-4 border-muted-foreground/30 bg-muted/50 pl-4 py-2"
              >
                <p className="text-sm italic text-foreground">"{quote.quote}"</p>
                {quote.significance && (
                  <p className="mt-1 text-xs text-muted-foreground">— {quote.significance}</p>
                )}
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* 标签云 */}
      {analysis.scoreDimensions && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">评分维度</h4>
          <div className="flex flex-wrap gap-2">
            <ScoreBadge label="深度" value={analysis.scoreDimensions.depth || 5} />
            <ScoreBadge label="质量" value={analysis.scoreDimensions.quality || 5} />
            <ScoreBadge label="实用性" value={analysis.scoreDimensions.practicality || 5} />
            <ScoreBadge label="新颖性" value={analysis.scoreDimensions.novelty || 5} />
          </div>
        </div>
      )}

      {/* 分析元数据 */}
      <AnalysisMetadata
        model={analysis.analysisModel || 'unknown'}
        time={analysis.processingTime || 0}
        rounds={analysis.reflectionRounds || 0}
        analyzedAt={analysis.analyzedAt}
      />
    </Card>
  );
}

// 子组件

function ScoreDashboard({
  aiScore,
  scoreDimensions,
}: {
  aiScore: number;
  scoreDimensions?: any;
}) {
  return (
    <div className="flex items-center gap-6">
      {/* 总分仪表 */}
      <div className="relative h-20 w-20">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
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
            strokeDasharray={`${(aiScore / 10) * 251} 251`}
            strokeLinecap="round"
            className={aiScore >= 8 ? 'text-green-500' : aiScore >= 6 ? 'text-yellow-500' : 'text-orange-500'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{aiScore.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <h4 className="font-semibold">AI 内容评分</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <ScoreBarItem label="深度" value={scoreDimensions?.depth || 5} />
          <ScoreBarItem label="质量" value={scoreDimensions?.quality || 5} />
          <ScoreBarItem label="实用性" value={scoreDimensions?.practicality || 5} />
          <ScoreBarItem label="新颖性" value={scoreDimensions?.novelty || 5} />
        </div>
      </div>
    </div>
  );
}

function ScoreBarItem({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 8) return 'text-green-500';
    if (v >= 6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getColor(value)}`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${getColor(value)}`}>{value.toFixed(1)}</span>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const variant = value >= 8 ? 'primary' : value >= 6 ? 'secondary' : 'default';
  return (
    <Badge variant={variant} className="text-xs">
      {label}: {value.toFixed(1)}
    </Badge>
  );
}

function AnalysisMetadata({
  model,
  time,
  rounds,
  analyzedAt,
}: {
  model: string;
  time: number;
  rounds: number;
  analyzedAt?: Date;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-4">
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {Math.round(time / 1000)}s
      </span>
      <span>{model}</span>
      {rounds > 0 && (
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {rounds} 轮优化
        </span>
      )}
      {analyzedAt && (
        <span>
          {new Date(analyzedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
