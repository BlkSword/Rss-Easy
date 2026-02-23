/**
 * 系统日志监控组件
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ScrollText,
  RefreshCw,
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  FileJson,
  Clock,
  Filter,
  Download,
  Copy,
  Check,
  Calendar,
  Database,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { Select, Space, Modal } from 'antd';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { notifySuccess } from '@/lib/feedback';

const levelColors: Record<string, { bg: string; text: string; icon: any }> = {
  debug: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: FileJson },
  info: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Info },
  warn: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', icon: AlertTriangle },
  error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: XCircle },
  fatal: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: AlertCircle },
};

const categoryLabels: Record<string, string> = {
  system: '系统',
  rss: 'RSS抓取',
  ai: 'AI处理',
  auth: '认证',
  email: '邮件',
  api: 'API',
  queue: '队列',
};

export function LogsSettings() {
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showClearCard, setShowClearCard] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 复制到剪贴板
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      notifySuccess('已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  // 获取日志列表
  const {
    data: logsData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.logs.list.useInfiniteQuery(
    {
      level: selectedLevel as any || undefined,
      category: selectedCategory as any || undefined,
      limit: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: undefined,
    }
  );

  // 获取统计
  const { data: stats, refetch: refetchStats } = trpc.logs.stats.useQuery();

  // 清空日志
  const clearLogs = trpc.logs.clear.useMutation({
    onSuccess: () => {
      refetch();
      refetchStats();
    },
  });

  const allLogs = logsData?.pages.flatMap((page) => page.logs) || [];

  const filteredLogs = searchQuery
    ? allLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allLogs;

  // 清理14天前的日志
  const handleClearOldLogs = async () => {
    try {
      const result = await clearLogs.mutateAsync({ olderThanDays: 14 });
      notifySuccess(`已清理 ${result.deleted} 条日志`);
      setShowClearCard(false);
    } catch (err) {
      console.error('清理失败:', err);
    }
  };

  // 清理所有日志
  const handleClearAllLogs = async () => {
    try {
      const result = await clearLogs.mutateAsync({ clearAll: true });
      notifySuccess(`已清理 ${result.deleted} 条日志`);
      setShowClearCard(false);
    } catch (err) {
      console.error('清理失败:', err);
    }
  };

  const handleExportLogs = () => {
    const data = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {stats?.levelCounts && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.levelCounts.map(({ level, count }) => {
            const config = levelColors[level] || levelColors.info;
            const Icon = config.icon;
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(selectedLevel === level ? null : level)}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all duration-200',
                  selectedLevel === level
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-4 w-4', config.text)} />
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {level}
                  </span>
                </div>
                <div className="text-2xl font-bold">{count.toLocaleString()}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* 日志列表 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                系统日志
              </CardTitle>
              <CardDescription>
                共 {stats?.totalCount.toLocaleString() || 0} 条日志
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content="刷新" position="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    setIsRefreshing(true);
                    await Promise.all([refetch(), refetchStats()]);
                    setTimeout(() => setIsRefreshing(false), 300);
                  }}
                  disabled={isRefreshing}
                  className={cn(
                    'transition-all duration-200',
                    isRefreshing && 'hover:bg-transparent'
                  )}
                >
                  <RefreshCw className={cn(
                    'h-4 w-4 transition-transform duration-500',
                    isRefreshing && 'animate-spin'
                  )} />
                </Button>
              </Tooltip>
              <Tooltip content="导出日志" position="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportLogs}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="清空日志" position="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowClearCard(true)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* 筛选器 */}
          <div className="flex flex-col md:flex-row gap-3 pt-4">
            {/* 搜索 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索日志内容..."
                className={cn(
                  'w-full pl-9 pr-4 py-2 rounded-xl border-2 border-border bg-background',
                  'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
                  'transition-all text-sm placeholder:text-muted-foreground/50'
                )}
              />
            </div>

            {/* 级别筛选 */}
            <Select
              value={selectedLevel}
              onChange={(value) => setSelectedLevel(value)}
              placeholder="全部级别"
              allowClear
              className="min-w-[140px]"
              variant="outlined"
              options={[
                { value: 'info', label: 'INFO' },
                { value: 'warn', label: 'WARN' },
                { value: 'error', label: 'ERROR' },
                { value: 'debug', label: 'DEBUG' },
                { value: 'fatal', label: 'FATAL' },
              ]}
            />

            {/* 分类筛选 */}
            <Select
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              placeholder="全部分类"
              allowClear
              className="min-w-[140px]"
              variant="outlined"
              options={Object.entries(categoryLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-t border-border">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>暂无日志</p>
              </div>
            ) : (
              <div
                ref={logContainerRef}
                className="divide-y divide-border max-h-[600px] overflow-y-auto"
              >
                {filteredLogs.map((log) => {
                  const levelConfig = levelColors[log.level] || levelColors.info;
                  const LevelIcon = levelConfig.icon;
                  const isExpanded = expandedLog === log.id;

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'p-4 transition-colors cursor-pointer',
                        isExpanded ? 'bg-muted/50' : 'hover:bg-muted/30'
                      )}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* 级别图标 */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                            levelConfig.bg
                          )}
                        >
                          <LevelIcon className={cn('h-4 w-4', levelConfig.text)} />
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                'text-xs font-medium px-2 py-0.5 rounded-full uppercase',
                                levelConfig.bg,
                                levelConfig.text
                              )}
                            >
                              {log.level}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {categoryLabels[log.category] || log.category}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDistanceToNow(new Date(log.createdAt), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                          </div>

                          <p className={cn('mt-1 text-sm', log.level === 'error' && 'text-red-600')}>
                            {log.message}
                          </p>

                          {/* 展开详情 */}
                          {isExpanded && (
                            <div className="mt-3 space-y-3 text-sm">
                              {log.details && (
                                <div className="rounded-lg overflow-hidden relative group">
                                  <div className="bg-slate-800 dark:bg-slate-900 px-3 py-2 flex items-center justify-between">
                                    <div className="text-xs font-medium text-slate-400">
                                      详细数据
                                    </div>
                                    <Tooltip content={copiedId === `details-${log.id}` ? '已复制' : '复制到剪贴板'} position="left">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(JSON.stringify(log.details, null, 2), `details-${log.id}`);
                                        }}
                                        className={cn(
                                          'p-1.5 rounded-md transition-all',
                                          copiedId === `details-${log.id}`
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                                        )}
                                      >
                                        {copiedId === `details-${log.id}` ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </Tooltip>
                                  </div>
                                  <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-300 p-3 overflow-x-auto font-mono">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.stackTrace && (
                                <div className="rounded-lg overflow-hidden relative group">
                                  <div className="bg-red-900/80 dark:bg-red-950/80 px-3 py-2 flex items-center justify-between">
                                    <div className="text-xs font-medium text-red-300">
                                      错误堆栈
                                    </div>
                                    <Tooltip content={copiedId === `stack-${log.id}` ? '已复制' : '复制到剪贴板'} position="left">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(log.stackTrace || '', `stack-${log.id}`);
                                        }}
                                        className={cn(
                                          'p-1.5 rounded-md transition-all',
                                          copiedId === `stack-${log.id}`
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'hover:bg-red-800/50 text-red-300 hover:text-red-100'
                                        )}
                                      >
                                        {copiedId === `stack-${log.id}` ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </Tooltip>
                                  </div>
                                  <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-red-400 p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                                    {log.stackTrace}
                                  </pre>
                                </div>
                              )}
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                {log.userId && <span>用户: {log.userId}</span>}
                                {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                                {log.duration && <span>耗时: {log.duration}ms</span>}
                                {log.source && <span>来源: {log.source}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 展开指示器 */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 加载更多 */}
            {hasNextPage && (
              <div className="p-4 text-center border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => fetchNextPage()}
                  isLoading={isFetchingNextPage}
                >
                  加载更多
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最近错误 */}
      {stats?.recentErrors && stats.recentErrors.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              最近错误
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentErrors.map((error) => (
                <div
                  key={error.id}
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm group relative"
                >
                  <div className="flex items-start gap-2 text-red-600 font-medium">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{error.message}</span>
                    <button
                      onClick={() => handleCopy(error.message, `error-${error.id}`)}
                      className={cn(
                        'p-1.5 rounded-md transition-all flex-shrink-0',
                        'opacity-0 group-hover:opacity-100',
                        copiedId === `error-${error.id}`
                          ? 'bg-green-500/10 text-green-500'
                          : 'hover:bg-red-100 dark:hover:bg-red-800/30 text-red-500'
                      )}
                    >
                      {copiedId === `error-${error.id}` ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 ml-6">
                    {formatDistanceToNow(new Date(error.createdAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 清空日志确认弹窗 */}
      <Modal
        open={showClearCard}
        onCancel={() => setShowClearCard(false)}
        footer={null}
        centered
        width={420}
      >
        <div className="py-2">
          {/* 标题区域 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold">清空日志</h3>
              <p className="text-sm text-muted-foreground">选择要清理的日志范围</p>
            </div>
          </div>

          {/* 提示信息 */}
          <p className="text-sm text-muted-foreground mb-5 px-1">
            清理后日志将永久删除，此操作不可恢复，请谨慎操作。
          </p>

          {/* 选项按钮 */}
          <div className="space-y-3">
            <button
              onClick={handleClearOldLogs}
              disabled={clearLogs.isPending}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
                'hover:border-primary/30 hover:bg-primary/5',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">清理 14 天前的日志</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    保留最近 14 天的日志记录
                  </div>
                </div>
                {clearLogs.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </div>
            </button>

            <button
              onClick={handleClearAllLogs}
              disabled={clearLogs.isPending}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
                'border-red-200 hover:border-red-300 hover:bg-red-50',
                'dark:border-red-800 dark:hover:bg-red-900/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <Database className="h-4 w-4 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-red-600 dark:text-red-400">清理全部日志</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    删除所有日志记录，包括系统日志
                  </div>
                </div>
                {clearLogs.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                )}
              </div>
            </button>
          </div>

          {/* 取消按钮 */}
          <div className="mt-5 pt-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowClearCard(false)}
              disabled={clearLogs.isPending}
            >
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default LogsSettings;
