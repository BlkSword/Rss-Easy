/**
 * 数据管理设置组件
 */

'use client';

import { useState } from 'react';
import { Database, Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface DataSettingsProps {
  onOpenDeleteModal: () => void;
}

export function DataSettings({ onOpenDeleteModal }: DataSettingsProps) {
  const [importContent, setImportContent] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { mutateAsync: exportOPML } = trpc.settings.exportOPML.useMutation();
  const { mutateAsync: importOPML } = trpc.settings.importOPML.useMutation();
  const { mutate: clearAllEntries } = trpc.settings.clearAllEntries.useMutation();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportOPML();
      // 创建下载
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importContent.trim()) {
      notifyError('请先选择OPML文件');
      return;
    }

    setIsImporting(true);
    try {
      const result = await importOPML({ opmlContent: importContent });
      notifySuccess(`导入成功：新增 ${result.created} 个订阅源，跳过 ${result.skipped} 个`);
      setImportContent('');
      // 重置文件输入
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '导入失败');
    } finally {
      setIsImporting(false);
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
                从 OPML 文件导入订阅源，重复的订阅源将被跳过
              </p>
            </div>
            <div className="space-y-3">
              <label
                htmlFor="opml-file"
                className={cn(
                  'flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed',
                  'hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer',
                  importContent ? 'border-primary/30 bg-primary/5' : 'border-border'
                )}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {importContent ? '已选择文件' : '点击选择 OPML 文件'}
                </span>
                {importContent && (
                  <span className="text-xs text-primary mt-1">
                    {importContent.slice(0, 50)}...
                  </span>
                )}
                <input
                  id="opml-file"
                  type="file"
                  accept=".opml,.xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <Button
                variant="outline"
                onClick={handleImport}
                isLoading={isImporting}
                disabled={!importContent || isImporting}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                导入 OPML
              </Button>
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
    </div>
  );
}
