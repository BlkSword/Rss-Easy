/**
 * 数据管理设置组件
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle,
  XCircle,
  SkipForward,
  Loader2,
  Search,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';

interface DataSettingsProps {
  onOpenDeleteModal: () => void;
}

interface PreviewFeed {
  url: string;
  title: string;
  category?: string;
}

interface ImportProgress {
  phase: 'parsing' | 'discovering' | 'creating' | 'fetching' | 'completed';
  current: number;
  total: number;
  currentItem?: string;
  message: string;
  stats: {
    imported: number;
    skipped: number;
    failed: number;
  };
}

const phaseLabels: Record<ImportProgress['phase'], string> = {
  parsing: '解析文件',
  discovering: '智能识别',
  creating: '导入订阅源',
  fetching: '触发抓取',
  completed: '完成',
};

const phaseIcons: Record<ImportProgress['phase'], React.ReactNode> = {
  parsing: <FileText className="h-4 w-4" />,
  discovering: <Search className="h-4 w-4" />,
  creating: <Database className="h-4 w-4" />,
  fetching: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4" />,
};

export function DataSettings({ onOpenDeleteModal }: DataSettingsProps) {
  const [importContent, setImportContent] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    title: string;
    feeds: PreviewFeed[];
    categories: string[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    created: number;
    skipped: number;
    failed: number;
    total: number;
    details: Array<{
      url: string;
      title: string;
      status: 'imported' | 'skipped' | 'failed';
      message?: string;
    }>;
  } | null>(null);

  // 进度状态
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { mutateAsync: exportOPML } = trpc.settings.exportOPML.useMutation();
  const { mutateAsync: previewOPML } = trpc.settings.previewOPML.useMutation();
  const { mutateAsync: importOPML } = trpc.settings.importOPML.useMutation();
  const { mutate: clearAllEntries } = trpc.settings.clearAllEntries.useMutation();
  const { mutate: clearProgress } = trpc.settings.clearImportProgress.useMutation();
  const utils = trpc.useUtils();

  // 轮询进度
  const startProgressPolling = useCallback(() => {
    // 清除之前的轮询
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // 每 500ms 轮询一次
    progressIntervalRef.current = setInterval(async () => {
      try {
        const result = await utils.settings.getImportProgress.fetch();
        if (result) {
          setProgress(result);

          // 如果完成，停止轮询
          if (result.phase === 'completed') {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      }
    }, 500);
  }, [utils]);

  // 停止轮询
  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, [stopProgressPolling]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportOPML();
      const blob = new Blob([result.opml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notifySuccess('OPML 文件已导出');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setImportContent(content);
      setImportResult(null);
      setPreviewData(null);

      setIsPreviewing(true);
      try {
        const preview = await previewOPML({ opmlContent: content });
        if (preview.success) {
          setPreviewData({
            title: preview.title,
            feeds: preview.feeds,
            categories: preview.categories,
          });
        } else {
          notifyError(preview.error || '预览失败');
        }
      } catch (error) {
        notifyError(error instanceof Error ? error.message : '预览失败');
      } finally {
        setIsPreviewing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importContent.trim()) {
      notifyError('请先选择OPML文件');
      return;
    }

    setIsImporting(true);
    setShowProgressModal(true);
    setProgress(null);
    setImportResult(null);

    // 开始轮询进度
    startProgressPolling();

    try {
      const result = await importOPML({
        opmlContent: importContent,
        skipDiscovery: false,
      });

      setImportResult(result);

      if (result.success) {
        notifySuccess(`导入完成：新增 ${result.created} 个，跳过 ${result.skipped} 个，失败 ${result.failed} 个`);
      } else {
        notifyError('部分订阅源导入失败');
      }

      // 如果全部成功，清空状态
      if (result.success && result.failed === 0) {
        setImportContent('');
        setPreviewData(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '导入失败');
      setShowProgressModal(false);
    } finally {
      setIsImporting(false);
      stopProgressPolling();
    }
  };

  const handleCloseProgressModal = () => {
    if (progress?.phase === 'completed') {
      setShowProgressModal(false);
      clearProgress();
    }
  };

  const handleClearEntries = async () => {
    if (!confirm('确定要清空所有文章吗？此操作无法撤销。')) return;

    setIsClearing(true);
    try {
      await clearAllEntries();
      notifySuccess('所有文章已清空');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '清空失败');
    } finally {
      setIsClearing(false);
    }
  };

  const resetImport = () => {
    setImportContent('');
    setPreviewData(null);
    setImportResult(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // 计算进度百分比
  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* 导入/导出 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            导入/导出
          </CardTitle>
          <CardDescription>备份和迁移您的订阅源数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 导出OPML */}
          <div className="space-y-3">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                导出 OPML
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                导出所有订阅源为 OPML 文件，方便备份或迁移到其他RSS阅读器
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              isLoading={isExporting}
              leftIcon={<Download className="h-4 w-4" />}
            >
              导出 OPML
            </Button>
          </div>

          <div className="border-t border-border" />

          {/* 导入OPML */}
          <div className="space-y-3">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                导入 OPML
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                从 OPML 文件导入订阅源，支持智能识别订阅源信息
              </p>
            </div>
            <div className="space-y-3">
              <label
                htmlFor="opml-file"
                className={cn(
                  'flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed',
                  'hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer',
                  importContent ? 'border-primary/30 bg-primary/5' : 'border-border'
                )}
              >
                {isPreviewing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">正在解析文件...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-sm text-muted-foreground">
                      {importContent ? '点击更换文件' : '点击选择 OPML 文件'}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      支持 .opml 和 .xml 格式
                    </span>
                  </>
                )}
                <input
                  id="opml-file"
                  type="file"
                  accept=".opml,.xml"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isPreviewing || isImporting}
                />
              </label>

              {/* 预览区域 */}
              {previewData && !importResult && (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{previewData.title || 'OPML 文件'}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetImport}>
                      取消
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    发现 <span className="font-medium text-foreground">{previewData.feeds.length}</span> 个订阅源
                    {previewData.categories.length > 0 && (
                      <span>，<span className="font-medium text-foreground">{previewData.categories.length}</span> 个分类</span>
                    )}
                  </div>

                  {/* 订阅源列表预览 */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {previewData.feeds.slice(0, 20).map((feed, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/50"
                      >
                        <span className="truncate flex-1 font-medium">{feed.title || feed.url}</span>
                        {feed.category && (
                          <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {feed.category}
                          </span>
                        )}
                      </div>
                    ))}
                    {previewData.feeds.length > 20 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        还有 {previewData.feeds.length - 20} 个订阅源...
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={resetImport}
                      disabled={isImporting}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleImport}
                      isLoading={isImporting}
                      disabled={isImporting}
                      className="flex-1"
                    >
                      {isImporting ? '正在导入...' : `导入 ${previewData.feeds.length} 个订阅源`}
                    </Button>
                  </div>
                </div>
              )}

              {/* 导入结果 */}
              {importResult && (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {importResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium text-sm">
                        {importResult.success ? '导入完成' : '导入完成（部分失败）'}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetImport}>
                      继续导入
                    </Button>
                  </div>

                  {/* 统计 */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold text-foreground">{importResult.total}</div>
                      <div className="text-xs text-muted-foreground">总计</div>
                    </div>
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <div className="text-lg font-bold text-green-600">{importResult.created}</div>
                      <div className="text-xs text-green-600">成功</div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <div className="text-lg font-bold text-amber-600">{importResult.skipped}</div>
                      <div className="text-xs text-amber-600">跳过</div>
                    </div>
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <div className="text-lg font-bold text-red-600">{importResult.failed}</div>
                      <div className="text-xs text-red-600">失败</div>
                    </div>
                  </div>

                  {/* 详细结果列表 */}
                  {importResult.details.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {importResult.details.map((item, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center gap-2 text-xs py-1.5 px-2 rounded",
                            item.status === 'imported' && "bg-green-500/10",
                            item.status === 'skipped' && "bg-amber-500/10",
                            item.status === 'failed' && "bg-red-500/10"
                          )}
                        >
                          {item.status === 'imported' && <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />}
                          {item.status === 'skipped' && <SkipForward className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                          {item.status === 'failed' && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                          <span className="truncate flex-1">{item.title}</span>
                          {item.message && (
                            <span className="text-muted-foreground truncate max-w-[120px]">
                              {item.message}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据清理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Database className="h-5 w-5" />
            数据清理
          </CardTitle>
          <CardDescription>清理和删除数据，操作不可撤销</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 清空文章 */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-950/20">
            <div>
              <div className="font-medium">清空所有文章</div>
              <div className="text-sm text-muted-foreground mt-1">
                删除所有文章记录，订阅源和分类保留
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearEntries}
              isLoading={isClearing}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              清空文章
            </Button>
          </div>

          {/* 删除账户 */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-950/20">
            <div>
              <div className="font-medium">删除账户</div>
              <div className="text-sm text-muted-foreground mt-1">
                永久删除您的账户和所有数据
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={onOpenDeleteModal}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              删除账户
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 警告提示 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-sm text-amber-800 dark:text-amber-300">重要提醒</h4>
              <ul className="text-sm text-amber-700 dark:text-amber-400 mt-2 space-y-1">
                <li>• 清空文章后，所有文章内容将被永久删除</li>
                <li>• 删除账户后，所有数据包括订阅源、文章、设置等都将无法恢复</li>
                <li>• 建议在执行这些操作前先导出 OPML 备份您的订阅源</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 导入进度 Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={handleCloseProgressModal}
        title="正在导入订阅源"
        size="md"
        footer={
          progress?.phase === 'completed' ? (
            <Button variant="primary" onClick={handleCloseProgressModal}>
              完成
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          {/* 当前阶段 */}
          {progress && (
            <>
              {/* 阶段指示器 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    progress.phase === 'completed' ? 'bg-green-500/10' : 'bg-primary/10'
                  )}>
                    {phaseIcons[progress.phase]}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{phaseLabels[progress.phase]}</div>
                    <div className="text-xs text-muted-foreground">{progress.message}</div>
                  </div>
                </div>
                {progress.total > 0 && (
                  <div className="text-right">
                    <div className="text-lg font-bold">{progress.current}/{progress.total}</div>
                    <div className="text-xs text-muted-foreground">{progressPercent}%</div>
                  </div>
                )}
              </div>

              {/* 进度条 */}
              {progress.total > 0 && (
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300 rounded-full',
                      progress.phase === 'completed' ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* 当前处理的订阅源 */}
              {progress.currentItem && progress.phase === 'creating' && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="truncate">{progress.currentItem}</span>
                </div>
              )}

              {/* 实时统计 */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="text-center p-2 rounded-lg bg-green-500/10">
                  <div className="text-lg font-bold text-green-600">{progress.stats.imported}</div>
                  <div className="text-xs text-green-600">成功</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-500/10">
                  <div className="text-lg font-bold text-amber-600">{progress.stats.skipped}</div>
                  <div className="text-xs text-amber-600">跳过</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/10">
                  <div className="text-lg font-bold text-red-600">{progress.stats.failed}</div>
                  <div className="text-xs text-red-600">失败</div>
                </div>
              </div>
            </>
          )}

          {/* 等待进度 */}
          {!progress && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">正在初始化导入任务...</p>
            </div>
          )}

          {/* 阶段流程说明 */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {(['parsing', 'discovering', 'creating', 'fetching', 'completed'] as const).map((phase, index) => (
                <div
                  key={phase}
                  className={cn(
                    'flex flex-col items-center',
                    progress && (
                      Object.keys(phaseLabels).indexOf(progress.phase) >= index
                        ? 'text-primary'
                        : 'text-muted-foreground/50'
                    )
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center mb-1',
                    progress && Object.keys(phaseLabels).indexOf(progress.phase) >= index
                      ? 'bg-primary/10'
                      : 'bg-muted'
                  )}>
                    {index + 1}
                  </div>
                  <span className="hidden md:block">{phaseLabels[phase]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
