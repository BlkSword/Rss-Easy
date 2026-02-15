/**
 * 队列状态指示器组件
 * 显示实时队列状态，包括 AI 分析队列和 Feed 抓取状态
 * 优化版：增加待更新订阅源详细列表
 */

'use client';

import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Cpu,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Loader2,
  Rss,
  Brain,
  ChevronRight,
  AlertTriangle,
  Database,
  RefreshCw,
  ExternalLink,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

// 格式化时间
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

// 格式化相对时间
function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '从未';
  return dayjs(date).fromNow();
}

/**
 * 队列状态指示器
 */
function QueueStatusIndicatorComponent() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'feeds'>('overview');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 获取详细监控数据（每5秒刷新）
  const { data: monitor, isLoading } = trpc.queue.detailedMonitor.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // 获取待更新订阅源（展开时加载）
  const { data: feedsToUpdate } = trpc.queue.feedsToUpdate.useQuery(
    { limit: 15 },
    {
      refetchInterval: 10000,
      enabled: isExpanded && activeTab === 'feeds',
    }
  );

  useEffect(() => {
    if (monitor) {
      setLastUpdate(new Date());
    }
  }, [monitor]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.queue-status-container')) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  const queue = monitor?.queue ?? { pending: 0, processing: 0, completed: 0, failed: 0, total: 0, activeTasks: [] };
  const feeds = monitor?.feeds ?? { total: 0, active: 0, errors: 0, toUpdate: 0, recentlyFetched: 0, healthScore: 100 };
  const entries = monitor?.entries ?? { total: 0, lastHour: 0, lastDay: 0, unread: 0, starred: 0 };
  const scheduler = monitor?.scheduler ?? { isRunning: false, fetchInterval: 0, aiProcessInterval: 0 };
  const health = monitor?.health ?? { status: 'healthy', message: '' };

  // 判断是否有活跃任务
  const hasActivity = queue.processing > 0 || queue.pending > 0 || feeds.toUpdate > 0;

  // 状态颜色
  const getStatusColor = useCallback(() => {
    if (health.status === 'warning') return 'text-amber-500';
    if (queue.processing > 0) return 'text-green-500';
    if (queue.pending > 0) return 'text-blue-500';
    if (queue.failed > 0) return 'text-red-500';
    return 'text-muted-foreground';
  }, [health.status, queue.processing, queue.pending, queue.failed]);

  return (
    <div className="queue-status-container relative">
      {/* 主按钮 */}
      <Tooltip
        content={
          hasActivity
            ? `处理中: ${queue.processing}, 待处理: ${queue.pending}, 待更新订阅源: ${feeds.toUpdate}`
            : '系统状态正常'
        }
        position="bottom"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'relative transition-all duration-300',
            hasActivity && 'animate-pulse-soft'
          )}
        >
          <Activity className={cn('h-4 w-4', getStatusColor())} />
          {(queue.processing > 0 || queue.pending > 0 || feeds.toUpdate > 0) && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
            >
              {queue.processing + queue.pending + (feeds.toUpdate > 0 ? 1 : 0)}
            </motion.span>
          )}
        </Button>
      </Tooltip>

      {/* 展开面板 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-96 z-50"
          >
            <div className="frosted-glass rounded-xl border border-border/60 shadow-xl overflow-hidden">
              {/* 头部 */}
              <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">系统监控</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      health.status === 'healthy' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                    )}>
                      {health.status === 'healthy' ? '正常' : '警告'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        scheduler.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      )} />
                      {scheduler.isRunning ? '运行中' : '已停止'}
                    </div>
                    {/* 移动端关闭按钮 */}
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="md:hidden p-1 rounded-lg hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Tab 切换 */}
                <div className="flex gap-1 mt-3">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      activeTab === 'overview'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    概览
                  </button>
                  <button
                    onClick={() => setActiveTab('feeds')}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1',
                      activeTab === 'feeds'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Rss className="h-3 w-3" />
                    待更新 {feeds.toUpdate > 0 && `(${feeds.toUpdate})`}
                  </button>
                </div>
              </div>

              {/* 内容 */}
              <div className="p-4 space-y-4 max-h-[50vh] md:max-h-[450px] overflow-y-auto">
                {isLoading ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm">加载中...</p>
                  </div>
                ) : activeTab === 'overview' ? (
                  <>
                    {/* AI 分析队列 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium">AI 分析队列</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          共 {queue.total} 个任务
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <QueueStatCard
                          label="处理中"
                          value={queue.processing}
                          icon={<Loader2 className="h-3 w-3 animate-spin" />}
                          color="green"
                        />
                        <QueueStatCard
                          label="待处理"
                          value={queue.pending}
                          icon={<Clock className="h-3 w-3" />}
                          color="blue"
                        />
                        <QueueStatCard
                          label="已完成"
                          value={queue.completed}
                          icon={<CheckCircle className="h-3 w-3" />}
                          color="muted"
                        />
                        <QueueStatCard
                          label="失败"
                          value={queue.failed}
                          icon={<XCircle className="h-3 w-3" />}
                          color="red"
                        />
                      </div>
                    </div>

                    {/* 当前活跃任务 */}
                    {queue.activeTasks && queue.activeTasks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">正在处理</span>
                        </div>
                        <div className="space-y-2">
                          {queue.activeTasks.map((task) => (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs"
                            >
                              <Loader2 className="h-3 w-3 mt-0.5 animate-spin text-green-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{task.entryTitle}</p>
                                <p className="text-muted-foreground truncate">{task.feedTitle}</p>
                                <p className="text-muted-foreground/60 mt-1">
                                  已处理 {formatTime(task.processingTime)}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feed 状态概览 */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Rss className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">订阅源状态</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">总订阅源</span>
                          <span className="font-medium">{feeds.total}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">活跃</span>
                          <span className="font-medium text-green-500">{feeds.active}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">待更新</span>
                          <button
                            onClick={() => setActiveTab('feeds')}
                            className={cn(
                              'font-medium flex items-center gap-1',
                              feeds.toUpdate > 0 ? 'text-orange-500 hover:underline' : ''
                            )}
                          >
                            {feeds.toUpdate}
                            {feeds.toUpdate > 0 && <ChevronRight className="h-3 w-3" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">错误</span>
                          <span className={cn(
                            'font-medium',
                            feeds.errors > 0 ? 'text-red-500' : ''
                          )}>
                            {feeds.errors}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 文章统计 */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">文章统计</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">总文章</span>
                          <span className="font-medium">{entries.total}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">未读</span>
                          <span className="font-medium text-blue-500">{entries.unread}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">最近1小时</span>
                          <span className="font-medium text-green-500">+{entries.lastHour}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground">今天</span>
                          <span className="font-medium text-green-500">+{entries.lastDay}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* 待更新订阅源列表 */
                  <div>
                    {feedsToUpdate && feedsToUpdate.length > 0 ? (
                      <div className="space-y-2">
                        {feedsToUpdate.map((feed, index) => (
                          <motion.div
                            key={feed.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                              feed.hasError
                                ? 'border-red-200 bg-red-50/50'
                                : 'border-border/60 bg-muted/30 hover:bg-muted/50'
                            )}
                          >
                            {/* 图标 */}
                            <div className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                              feed.hasError ? 'bg-red-500/10' : 'bg-orange-500/10'
                            )}>
                              {feed.iconUrl ? (
                                <img
                                  src={feed.iconUrl}
                                  alt=""
                                  className="w-5 h-5 rounded"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Rss className={cn(
                                  'h-4 w-4',
                                  feed.hasError ? 'text-red-500' : 'text-orange-500'
                                )} />
                              )}
                            </div>

                            {/* 信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{feed.title}</p>
                                {feed.hasError && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {feed.lastFetchedAt
                                    ? `${formatRelativeTime(feed.lastFetchedAt)}抓取`
                                    : '尚未抓取'
                                  }
                                </span>
                              </div>
                              {feed.hasError && feed.lastError && (
                                <p className="text-xs text-red-500/80 mt-1 truncate">
                                  错误: {feed.lastError}
                                </p>
                              )}
                              {feed.category && (
                                <div className="mt-1.5">
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: feed.category.color ? `${feed.category.color}20` : undefined,
                                      color: feed.category.color || undefined,
                                    }}
                                  >
                                    {feed.category.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 状态 */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={cn(
                                'text-xs font-medium',
                                feed.isOverdue ? 'text-orange-500' : 'text-muted-foreground'
                              )}>
                                {feed.isOverdue ? '待更新' : '计划中'}
                              </span>
                              {feed.unreadCount > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {feed.unreadCount} 未读
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {feeds.toUpdate > feedsToUpdate.length && (
                          <p className="text-xs text-center text-muted-foreground py-2">
                            还有 {feeds.toUpdate - feedsToUpdate.length} 个订阅源待更新
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">所有订阅源都是最新的</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 最后更新时间 */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      最后更新
                    </span>
                    <span>
                      {lastUpdate
                        ? lastUpdate.toLocaleTimeString('zh-CN')
                        : '---'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 队列状态卡片
 */
const QueueStatCard = memo(function QueueStatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'muted';
}) {
  const colorClasses = {
    green: 'text-green-500',
    blue: 'text-blue-500',
    red: 'text-red-500',
    muted: 'text-muted-foreground',
  };

  const displayValue = value === 0 ? '-' : value;

  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30">
      <div className={cn('mb-1', value > 0 ? colorClasses[color] : 'text-muted-foreground/50')}>
        {icon}
      </div>
      <span className={cn('text-lg font-bold', value > 0 ? colorClasses[color] : 'text-muted-foreground/50')}>
        {displayValue}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
});

// 使用 React.memo 优化性能
const QueueStatusIndicator = memo(QueueStatusIndicatorComponent);

export default QueueStatusIndicator;
export { QueueStatusIndicator };
