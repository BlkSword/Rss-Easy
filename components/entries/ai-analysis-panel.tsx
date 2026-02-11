/**
 * AI 分析面板组件
 * 简化版本 - 点击生成，显示加载状态
 */

'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';

interface AIAnalysisPanelProps {
  entryId: string;
  hasSummary: boolean;
  summary?: string;
  onComplete?: () => void;
}

export function AIAnalysisPanel({ entryId, hasSummary, summary, onComplete }: AIAnalysisPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const { mutate: analyzeEntry, status } = trpc.entries.analyze.useMutation({
    onSuccess: () => {
      setIsGenerating(false);
      onComplete?.();
    },
    onError: () => {
      setIsGenerating(false);
    },
  });

  const handleGenerate = async () => {
    if (status === 'pending' || isGenerating) return;

    setIsGenerating(true);
    try {
      await analyzeEntry({
        entryId,
        analysisType: 'summary',
      });
    } catch (error) {
      console.error('AI 分析失败:', error);
      setIsGenerating(false);
    }
  };

  // 如果已有摘要，不显示组件
  if (hasSummary) {
    return null;
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={status === 'pending' || isGenerating}
      className={cn(
        'w-full flex items-center justify-center gap-3 p-4 rounded-xl border-2',
        'border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10',
        'transition-all duration-200',
        (status === 'pending' || isGenerating) && 'cursor-wait opacity-70'
      )}
    >
      {(status === 'pending' || isGenerating) ? (
        <>
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="text-sm font-medium text-primary">AI 正在生成摘要...</span>
        </>
      ) : (
        <>
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">点击生成 AI 摘要</span>
        </>
      )}
    </button>
  );
}

export default AIAnalysisPanel;
