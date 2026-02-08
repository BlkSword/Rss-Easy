'use client';

/**
 * 分析反馈组件
 *
 * 允许用户对 AI 分析结果提供反馈
 * 用于持续改进分析质量
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api } from '@/trpc/react';
import { ThumbsUp, ThumbsDown, Star, Send, X } from 'lucide-react';

interface AnalysisFeedbackProps {
  entryId: string;
  currentAnalysis?: {
    summary?: string;
    mainPoints?: Array<{ point: string; explanation?: string }>;
    tags?: string[];
  };
  onSubmit?: () => void;
}

export function AnalysisFeedback({
  entryId,
  currentAnalysis,
  onSubmit,
}: AnalysisFeedbackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [summaryIssue, setSummaryIssue] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [isHelpful, setIsHelpful] = useState<boolean>();
  const [comments, setComments] = useState('');

  const { mutate: submitFeedback, status } =
    api.analytics.submitFeedback.useMutation({
      onSuccess: () => {
        // 重置表单
        setSummaryIssue('');
        setTagSuggestions('');
        setRating(0);
        setIsHelpful(undefined);
        setComments('');
        setIsOpen(false);
        onSubmit?.();
      },
    });

  const isLoading = status === 'pending';

  const handleSubmit = () => {
    submitFeedback({
      entryId,
      summaryIssue: summaryIssue || undefined,
      tagSuggestions: tagSuggestions
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      rating: rating || undefined,
      isHelpful,
      comments: comments || undefined,
    });
  };

  if (!isOpen) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
        <div className="text-sm text-muted-foreground">
          这个分析有帮助吗？
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsHelpful(true);
              setIsOpen(true);
            }}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            有帮助
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsHelpful(false);
              setIsOpen(true);
            }}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            没帮助
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
          >
            详细反馈
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            分析反馈
            {isHelpful !== undefined && (
              <Badge variant={isHelpful ? 'primary' : 'danger'}>
                {isHelpful ? '有帮助' : '没帮助'}
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            帮助我们改进分析质量
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 评分 */}
      <div>
        <label className="text-sm font-medium">评分</label>
        <div className="flex gap-2 mt-2">
          {[1, 2, 3, 4, 5].map(score => (
            <button
              key={score}
              onClick={() => setRating(score)}
              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                rating === score
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted hover:border-primary/50'
              }`}
              type="button"
            >
              <Star
                className={`h-5 w-5 ${
                  rating >= score ? 'fill-current' : ''
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 是否有帮助 */}
      <div>
        <label className="text-sm font-medium">这个分析有帮助吗？</label>
        <div className="flex gap-2 mt-2">
          <Button
            variant={isHelpful === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsHelpful(true)}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            有帮助
          </Button>
          <Button
            variant={isHelpful === false ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setIsHelpful(false)}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            没帮助
          </Button>
        </div>
      </div>

      {/* 摘要问题 */}
      <div>
        <label className="text-sm font-medium">摘要有什么问题？</label>
        <Textarea
          value={summaryIssue}
          onChange={(e) => setSummaryIssue(e.target.value)}
          placeholder="例如：摘要不够准确、遗漏了重要观点、过于冗长..."
          rows={2}
          className="mt-2"
        />
      </div>

      {/* 标签建议 */}
      <div>
        <label className="text-sm font-medium">标签建议</label>
        <Textarea
          value={tagSuggestions}
          onChange={(e) => setTagSuggestions(e.target.value)}
          placeholder="例如：React, 性能优化, 最佳实践（用逗号分隔）"
          rows={2}
          className="mt-2"
        />
        {currentAnalysis?.tags && currentAnalysis.tags.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">当前标签：</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {currentAnalysis.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 其他意见 */}
      <div>
        <label className="text-sm font-medium">其他意见或建议</label>
        <Textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="任何其他意见或建议..."
          rows={3}
          className="mt-2"
        />
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => setIsOpen(false)}
          disabled={isLoading}
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isLoading || (!rating && !summaryIssue && !tagSuggestions && !comments)}
        >
          {isLoading ? (
            <>提交中...</>
          ) : (
            <>
              <Send className="h-4 w-4 mr-1" />
              提交反馈
            </>
          )}
        </Button>
      </div>

      {/* 提示信息 */}
      <div className="text-xs text-muted-foreground">
        您的反馈将帮助我们改进 AI 分析质量
      </div>
    </div>
  );
}

/**
 * 简洁版反馈组件
 *
 * 只显示有帮助/没帮助按钮
 */
export function QuickAnalysisFeedback({ entryId, onSubmit }: { entryId: string; onSubmit?: () => void }) {
  const { mutate: submitFeedback, status } =
    api.analytics.submitFeedback.useMutation({
      onSuccess: () => {
        onSubmit?.();
      },
    });

  const isLoading = status === 'pending';

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>这个分析有帮助吗？</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => submitFeedback({ entryId, isHelpful: true })}
        disabled={isLoading}
      >
        <ThumbsUp className="h-3 w-3 mr-1" />
        有帮助
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => submitFeedback({ entryId, isHelpful: false })}
        disabled={isLoading}
      >
        <ThumbsDown className="h-3 w-3 mr-1" />
        没帮助
      </Button>
    </div>
  );
}
