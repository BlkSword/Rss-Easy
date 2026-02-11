/**
 * 高级AI分析面板组件
 * 展示AI-Native深度分析结果：情感倾向、重要性评分、主要观点、关键引用等
 */

'use client';

import {
  Heart,
  TrendingUp,
  Lightbulb,
  Quote,
  BarChart3,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AdvancedAIPanelProps {
  entry: {
    aiSentiment?: string | null;
    aiImportanceScore?: number;
    aiOneLineSummary?: string | null;
    aiMainPoints?: any;
    aiKeyQuotes?: any;
    aiScoreDimensions?: any;
    aiAnalysisModel?: string | null;
    aiProcessingTime?: number | null;
    aiAnalyzedAt?: Date | null;
  };
}

export function AdvancedAIPanel({ entry }: AdvancedAIPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSections(newExpanded);
  };

  // 如果没有任何高级AI分析数据，不显示组件
  const hasAnyData =
    entry.aiSentiment ||
    (entry.aiImportanceScore !== undefined && entry.aiImportanceScore > 0) ||
    entry.aiOneLineSummary ||
    entry.aiMainPoints ||
    entry.aiKeyQuotes ||
    entry.aiScoreDimensions;

  if (!hasAnyData) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.02] to-transparent">
      <div className="p-6 space-y-6">
        {/* 标题 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI 深度分析</h3>
            {entry.aiAnalysisModel && (
              <p className="text-xs text-muted-foreground mt-0.5">
                模型: {entry.aiAnalysisModel}
                {entry.aiProcessingTime && ` · 耗时 ${Math.round(entry.aiProcessingTime / 1000)}s`}
              </p>
            )}
          </div>
        </div>

        {/* 一句话总结 */}
        {entry.aiOneLineSummary && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-blue-500 mb-1">一句话总结</div>
                <p className="text-sm text-foreground/80">{entry.aiOneLineSummary}</p>
              </div>
            </div>
          </div>
        )}

        {/* 情感倾向和重要性 */}
        {(entry.aiSentiment || (entry.aiImportanceScore !== undefined && entry.aiImportanceScore > 0)) && (
          <div className="grid grid-cols-2 gap-4">
            {entry.aiSentiment && (
              <div className="p-4 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className={cn(
                    "h-4 w-4",
                    entry.aiSentiment === 'positive' && "text-green-500",
                    entry.aiSentiment === 'negative' && "text-red-500",
                    entry.aiSentiment === 'neutral' && "text-gray-500"
                  )} />
                  <span className="text-sm font-medium">情感倾向</span>
                </div>
                <div className={cn(
                  "inline-block px-3 py-1 rounded-lg text-sm font-medium",
                  entry.aiSentiment === 'positive' && "bg-green-500/10 text-green-500",
                  entry.aiSentiment === 'negative' && "bg-red-500/10 text-red-500",
                  entry.aiSentiment === 'neutral' && "bg-gray-500/10 text-gray-500"
                )}>
                  {entry.aiSentiment === 'positive' && '积极'}
                  {entry.aiSentiment === 'negative' && '消极'}
                  {entry.aiSentiment === 'neutral' && '中性'}
                </div>
              </div>
            )}

            {entry.aiImportanceScore !== undefined && entry.aiImportanceScore > 0 && (
              <div className="p-4 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">重要性评分</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${entry.aiImportanceScore * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-orange-500">
                    {Math.round(entry.aiImportanceScore * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 评分维度 */}
        {entry.aiScoreDimensions && (
          <CollapsibleSection
            title="评分维度"
            icon={BarChart3}
            expanded={expandedSections.has('scoreDimensions')}
            onToggle={() => toggleSection('scoreDimensions')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(entry.aiScoreDimensions).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1 capitalize">
                    {key === 'depth' && '深度'}
                    {key === 'quality' && '质量'}
                    {key === 'practicality' && '实用性'}
                    {key === 'novelty' && '新颖性'}
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {(value as number).toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* 主要观点 */}
        {entry.aiMainPoints && Array.isArray(entry.aiMainPoints) && entry.aiMainPoints.length > 0 && (
          <CollapsibleSection
            title="主要观点"
            icon={Lightbulb}
            expanded={expandedSections.has('mainPoints')}
            onToggle={() => toggleSection('mainPoints')}
          >
            <div className="space-y-3">
              {entry.aiMainPoints.map((point: any, index: number) => (
                <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/20">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {point.point}
                    </p>
                    {point.explanation && (
                      <p className="text-xs text-muted-foreground">
                        {point.explanation}
                      </p>
                    )}
                  </div>
                  {point.importance && (
                    <div className="flex-shrink-0">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        point.importance >= 0.8 && "bg-green-500/10 text-green-500",
                        point.importance >= 0.5 && "bg-blue-500/10 text-blue-500",
                        point.importance < 0.5 && "bg-gray-500/10 text-gray-500"
                      )}>
                        {Math.round(point.importance * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* 关键引用 */}
        {entry.aiKeyQuotes && Array.isArray(entry.aiKeyQuotes) && entry.aiKeyQuotes.length > 0 && (
          <CollapsibleSection
            title="关键引用"
            icon={Quote}
            expanded={expandedSections.has('keyQuotes')}
            onToggle={() => toggleSection('keyQuotes')}
          >
            <div className="space-y-3">
              {entry.aiKeyQuotes.map((quote: any, index: number) => (
                <div key={index} className="p-4 rounded-lg bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10">
                  <p className="text-sm italic text-foreground/90 mb-2">
                    "{quote.quote}"
                  </p>
                  {quote.significance && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">意义：</span>
                      {quote.significance}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </Card>
  );
}

// 可折叠区块组件
interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon: Icon, expanded, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-muted/10 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

export default AdvancedAIPanel;
