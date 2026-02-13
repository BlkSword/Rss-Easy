/**
 * 队列状态指示器组件
 * 显示实时队列状态，包括 AI 分析队列和 Feed 抓取状态
 */

'use client';

import { useState, useEffect, memo, useCallback } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * 队列状态指示器
 */
function QueueStatusIndicatorComponent() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 获取系统概览（每5秒刷新）
  const { data: overview } = trpc.queue.systemOverview.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // 获取活跃任务
  const { data: activeTasks } = trpc.queue.activeTasks.useQuery(undefined, {
    refetchInterval: 3000,
    enabled: isExpanded,
  });

  useEffect(() => {
    if (overview) {
      setLastUpdate(new Date());
    }
  }, [overview]);

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

  const queue = overview?.queue ?? { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  const scheduler = overview?.scheduler ?? { isRunning: false, fetchInterval: 0, aiProcessInterval: 0 };
  const feeds = overview?.feeds ?? { toUpdate: 0 };

  // 判断是否有活跃任务
  const hasActivity = queue.processing > 0 || queue.pending > 0;

  // 状态颜色
  const getStatusColor = () => {
    if (queue.processing > 0) return 'text-green-500';
    if (queue.pending > 0) return 'text-blue-500';
    if (queue.failed > 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  // 格式化时间
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <div className="queue-status-container relative">
      {/* 主按钮 */}
      <Tooltip
        content={
          hasActivity
            ? `处理中: ${queue.processing}, 待处理: ${queue.pending}`
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
          {(queue.processing > 0 || queue.pending > 0) && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
            >
              {queue.processing + queue.pending}
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
            className="absolute right-0 top-full mt-2 w-80 z-50"
          >
            <div className="frosted-glass rounded-xl border border-border/60 shadow-xl overflow-hidden">
              {/* 头部 */}
              <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">系统状态</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      scheduler.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    )} />
                    {scheduler.isRunning ? '运行中' : '已停止'}
                  </div>
                </div>
              </div>

              {/* 内容 */}
              <div className="p-4 space-y-4">
                {/* AI 分析队列 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">AI 分析队列</span>
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

                {/* Feed 抓取状态 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Rss className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Feed 抓取</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">待更新订阅源</span>
                    <span className={cn(
                      'font-medium',
                      feeds.toUpdate > 0 ? 'text-orange-500' : 'text-muted-foreground'
                    )}>
                      {feeds.toUpdate} 个
                    </span>
                  </div>
                </div>

                {/* 当前活跃任务 */}
                {activeTasks && activeTasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">正在处理</span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {activeTasks.map((task) => (
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

                {/* 最后更新时间 */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>最后更新</span>
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
function QueueStatCard({
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

  // 当值为0时显示"-"
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
}

// 使用 React.memo 优化性能
const QueueStatusIndicator = memo(QueueStatusIndicatorComponent);

export default QueueStatusIndicator;
export { QueueStatusIndicator };
