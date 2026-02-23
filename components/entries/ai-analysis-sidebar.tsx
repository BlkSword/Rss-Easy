/**
 * AI 分析侧栏组件
 * 分为三个部分：1. 一句话总结、摘要、主要内容 2. AI 评分、开源、文章长度、标签 3. 相关阅读
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  FileText,
  Target,
  Hash,
  TrendingUp,
  MessageSquare,
  Clock,
  Link2,
  Github,
  Star,
  Code,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Typewriter } from '@/components/animation/typewriter';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// =====================================================
// 类型定义
// =====================================================

interface ScoreDimensions {
  depth?: number;
  quality?: number;
  practicality?: number;
  novelty?: number;
}

interface OpenSourceInfo {
  isOpenSource?: boolean;
  repo?: string;
  license?: string;
  stars?: number;
  language?: string;
}

interface MainPoint {
  point: string;
  explanation?: string;
  importance?: number;
}

interface RelatedEntry {
  id: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  aiOneLineSummary: string | null;
  aiImportanceScore: number;
  feed: {
    id: string;
    title: string;
    iconUrl: string | null;
  };
  relevanceScore: number;
  relevanceReason: string;
}

interface AIAnalysisSidebarProps {
  entry: {
    id: string;
    title: string;
    content?: string | null;
    aiSummary?: string | null;
    aiOneLineSummary?: string | null;
    aiMainPoints?: any; // Json 类型，可以是数组或 null
    aiKeywords?: string[] | null;
    aiCategory?: string | null;
    aiSentiment?: string | null;
    aiImportanceScore?: number | null;
    aiScoreDimensions?: any; // Json 类型
    aiAnalyzedAt?: Date | null;
    readingTime?: number | null;
    contentLength?: number | null;
    wordCount?: number | null;
    isOpenSource?: boolean | null;
    openSourceRepo?: string | null;
    openSourceLicense?: string | null;
    openSourceStars?: number | null;
    openSourceLanguage?: string | null;
  };
}

// =====================================================
// 子组件
// =====================================================

/**
 * 评分维度卡片
 */
function ScoreDimensionCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30">
      <div className={cn('mb-1', color)}>{icon}</div>
      <span className={cn('text-sm font-bold', value >= 7 ? color : 'text-muted-foreground')}>
        {value || '-'}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * 标签组件
 */
function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'outline' | 'primary' }) {
  const variants = {
    default: 'bg-muted/50 text-muted-foreground border-border/50',
    outline: 'bg-transparent text-foreground border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs border',
      variants[variant]
    )}>
      {children}
    </span>
  );
}

/**
 * 可折叠区域
 */
function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-3 pt-0 border-t border-border/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 相关阅读卡片
 */
function RelatedEntryCard({ entry }: { entry: RelatedEntry }) {
  return (
    <a
      href={`/entries/${entry.id}`}
      className="block p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all group"
    >
      <div className="flex items-start gap-2">
        {entry.feed.iconUrl ? (
          <img
            src={entry.feed.iconUrl}
            alt=""
            className="w-5 h-5 rounded mt-0.5 flex-shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <FileText className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {entry.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{entry.feed.title}</span>
            {entry.relevanceReason && (
              <Tag variant="outline">{entry.relevanceReason}</Tag>
            )}
          </div>
          {entry.aiOneLineSummary && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {entry.aiOneLineSummary}
            </p>
          )}
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </a>
  );
}

// =====================================================
// 主组件
// =====================================================

export function AIAnalysisSidebar({ entry }: AIAnalysisSidebarProps) {
  // 获取 AI 配置状态
  const { data: aiConfigStatus } = trpc.queue.aiConfigStatus.useQuery();
  const isAIConfigured = aiConfigStatus?.hasApiKey && aiConfigStatus?.configValid;

  // 获取分析状态
  const { data: analysisStatus, refetch: refetchStatus } = trpc.queue.entryAnalysisStatus.useQuery(
    { entryId: entry.id },
    { enabled: !!entry.id && isAIConfigured }
  );

  // 触发分析
  const triggerAnalysis = trpc.queue.triggerAnalysis.useMutation({
    onSuccess: () => {
      refetchStatus();
    },
  });

  // 获取相关阅读
  const { data: relatedEntries, isLoading: isLoadingRelated } = trpc.entries.relatedEntries.useQuery(
    { entryId: entry.id, limit: 5 },
    { enabled: !!entry.id }
  );

  // 检查是否有分析结果
  const hasAnalysis = !!(
    entry.aiSummary ||
    entry.aiOneLineSummary ||
    (entry.aiMainPoints && Array.isArray(entry.aiMainPoints) && entry.aiMainPoints.length > 0) ||
    (entry.aiKeywords && entry.aiKeywords.length > 0) ||
    (entry.aiScoreDimensions && Object.values(entry.aiScoreDimensions as Record<string, number>).some(v => typeof v === 'number' && v > 0))
  );

  // 计算内容统计
  const contentStats = {
    length: entry.contentLength || entry.content?.length || 0,
    readingTime: entry.readingTime ? Math.ceil(entry.readingTime / 60) : 0,
    wordCount: entry.wordCount || 0,
  };

  // 获取分析状态信息
  const getAnalysisStatusInfo = () => {
    if (!aiConfigStatus) {
      return { type: 'loading', message: '检查配置中...', icon: Loader2, color: 'text-muted-foreground' };
    }

    if (!isAIConfigured) {
      return { type: 'no_config', message: 'AI 未配置', icon: Settings, color: 'text-yellow-500' };
    }

    if (hasAnalysis) {
      return { type: 'completed', message: '分析完成', icon: CheckCircle, color: 'text-green-500' };
    }

    if (!analysisStatus) {
      return { type: 'loading', message: '检查状态中...', icon: Loader2, color: 'text-muted-foreground' };
    }

    switch (analysisStatus.status) {
      case 'processing':
        return { type: 'processing', message: '正在分析中...', icon: Loader2, color: 'text-blue-500' };
      case 'pending':
        return { type: 'queued', message: `排队中 (第 ${(analysisStatus.queuePosition || 0) + 1} 位)`, icon: Clock, color: 'text-orange-500' };
      case 'failed':
        return { type: 'failed', message: '分析失败', icon: XCircle, color: 'text-red-500' };
      case 'not_analyzed':
        if (analysisStatus.reason === 'old_article') {
          return { type: 'old', message: '历史文章', icon: Clock, color: 'text-muted-foreground' };
        }
        return { type: 'not_queued', message: '等待分析', icon: Sparkles, color: 'text-muted-foreground' };
      default:
        return { type: 'unknown', message: '未知状态', icon: AlertTriangle, color: 'text-muted-foreground' };
    }
  };

  const statusInfo = getAnalysisStatusInfo();
  const StatusIcon = statusInfo.icon;

  // 评分维度数据
  const scoreDimensions = entry.aiScoreDimensions || {};
  const avgScore = entry.aiImportanceScore || 0;

  return (
    <aside className="w-80 flex-shrink-0 border-l border-border/60 bg-muted/20 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* ========== 状态指示 ========== */}
        {!hasAnalysis && (
          <div className="p-4 rounded-xl border-2 border-dashed border-border/60 bg-muted/30">
            <div className="flex flex-col items-center gap-3">
              <StatusIcon className={cn(
                'w-6 h-6',
                statusInfo.color,
                (statusInfo.type === 'processing' || statusInfo.type === 'loading') && 'animate-spin'
              )} />
              <p className="text-sm text-muted-foreground text-center">
                {statusInfo.message}
              </p>

              {statusInfo.type === 'no_config' && (
                <>
                  <p className="text-xs text-muted-foreground/60 text-center">
                    请先在设置中配置 AI API 密钥
                  </p>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = '/settings'}
                  >
                    前往设置
                  </Button>
                </>
              )}

              {statusInfo.type === 'failed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerAnalysis.mutate({ entryId: entry.id })}
                  disabled={triggerAnalysis.isPending}
                >
                  {triggerAnalysis.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  重新分析
                </Button>
              )}

              {(statusInfo.type === 'old' || statusInfo.type === 'not_queued') && (
                <Button
                  size="sm"
                  onClick={() => triggerAnalysis.mutate({ entryId: entry.id })}
                  disabled={triggerAnalysis.isPending}
                >
                  {triggerAnalysis.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  开始分析
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ========== 第一部分：核心分析 ========== */}
        {hasAnalysis && (
          <div className="space-y-3">
            {/* 一句话总结 */}
            {entry.aiOneLineSummary && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">一句话总结</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">
                  {entry.aiOneLineSummary}
                </p>
              </div>
            )}

            {/* 摘要 */}
            {entry.aiSummary && (
              <CollapsibleSection
                title="文章摘要"
                icon={<FileText className="w-4 h-4 text-blue-500" />}
              >
                <div className="text-sm text-muted-foreground leading-relaxed mt-2">
                  <Typewriter
                    text={entry.aiSummary}
                    speed={15}
                    delay={100}
                    showCursor={false}
                  />
                </div>
              </CollapsibleSection>
            )}

            {/* 主要内容/观点 */}
            {entry.aiMainPoints && Array.isArray(entry.aiMainPoints) && entry.aiMainPoints.length > 0 && (
              <CollapsibleSection
                title="主要内容"
                icon={<Target className="w-4 h-4 text-green-500" />}
              >
                <ul className="mt-2 space-y-2">
                  {entry.aiMainPoints.map((point: any, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <span className="text-foreground">{point.point}</span>
                        {point.explanation && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {point.explanation}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* ========== 第二部分：评分与元信息 ========== */}
        {hasAnalysis && (
          <div className="space-y-3">
            {/* AI 综合评分 */}
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">AI 评分</span>
                </div>
                {avgScore > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-lg font-bold text-primary">
                      {Math.round(avgScore * 10)}
                    </span>
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                )}
              </div>

              {/* 评分维度 */}
              <div className="grid grid-cols-4 gap-2">
                <ScoreDimensionCard
                  label="深度"
                  value={scoreDimensions.depth || 0}
                  icon={<BookOpen className="w-3 h-3" />}
                  color="text-blue-500"
                />
                <ScoreDimensionCard
                  label="质量"
                  value={scoreDimensions.quality || 0}
                  icon={<FileText className="w-3 h-3" />}
                  color="text-green-500"
                />
                <ScoreDimensionCard
                  label="实用"
                  value={scoreDimensions.practicality || 0}
                  icon={<Target className="w-3 h-3" />}
                  color="text-orange-500"
                />
                <ScoreDimensionCard
                  label="新颖"
                  value={scoreDimensions.novelty || 0}
                  icon={<Sparkles className="w-3 h-3" />}
                  color="text-purple-500"
                />
              </div>
            </div>

            {/* 文章信息 */}
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-3">
              {/* 开源信息 */}
              {entry.isOpenSource && (
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-gray-600" />
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">开源项目</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.openSourceLicense && (
                        <Tag variant="primary">{entry.openSourceLicense}</Tag>
                      )}
                      {entry.openSourceLanguage && (
                        <Tag variant="outline">
                          <Code className="w-3 h-3 mr-1" />
                          {entry.openSourceLanguage}
                        </Tag>
                      )}
                      {entry.openSourceStars && entry.openSourceStars > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          {entry.openSourceStars.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 文章长度 */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="w-4 h-4" />
                  <span>文章长度</span>
                </div>
                <div className="flex items-center gap-2">
                  {contentStats.length > 0 && (
                    <span className="text-xs">
                      {(contentStats.length / 1000).toFixed(1)}k 字
                    </span>
                  )}
                  {contentStats.readingTime > 0 && (
                    <Tag variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {contentStats.readingTime} 分钟
                    </Tag>
                  )}
                </div>
              </div>

              {/* 标签/关键词 */}
              {entry.aiKeywords && entry.aiKeywords.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Hash className="w-4 h-4" />
                    <span className="text-xs">关键词</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.aiKeywords.slice(0, 8).map((keyword, index) => (
                      <Tag key={index} variant="default">{keyword}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* AI 分类 */}
              {entry.aiCategory && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="w-4 h-4" />
                    <span className="text-xs">分类</span>
                  </div>
                  <Tag variant="primary">{entry.aiCategory}</Tag>
                </div>
              )}

              {/* 分析时间 */}
              {entry.aiAnalyzedAt && (
                <div className="text-xs text-muted-foreground text-right">
                  分析于 {dayjs(entry.aiAnalyzedAt).fromNow()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== 第三部分：相关阅读 ========== */}
        <CollapsibleSection
          title="相关阅读"
          icon={<Link2 className="w-4 h-4 text-indigo-500" />}
          defaultOpen={true}
        >
          <div className="mt-2 space-y-2">
            {isLoadingRelated ? (
              <div className="py-4 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : relatedEntries && relatedEntries.length > 0 ? (
              relatedEntries.map((relatedEntry) => (
                <RelatedEntryCard key={relatedEntry.id} entry={relatedEntry} />
              ))
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                暂无相关文章
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* 刷新分析按钮 */}
        {hasAnalysis && isAIConfigured && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => triggerAnalysis.mutate({ entryId: entry.id })}
            disabled={triggerAnalysis.isPending}
          >
            {triggerAnalysis.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            重新分析
          </Button>
        )}
      </div>
    </aside>
  );
}

export default AIAnalysisSidebar;
