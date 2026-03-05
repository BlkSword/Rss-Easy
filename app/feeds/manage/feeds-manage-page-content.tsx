/**
 * 订阅源管理页面内容 - 深度优化版
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit,
  Rss,
  FolderOpen,
  CheckSquare,
  Square,
  X,
  Save,
  Check,
  Loader2,
  Globe,
  Settings,
  Zap,
  AlertCircle,
  Upload as UploadIcon,
  FileText,
  SkipForward,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { Button, Input, Card, Space, Modal, Badge, Tag, Tooltip, Switch, Select, Empty, Tabs, Progress, Upload } from 'antd';
import type { MenuProps } from 'antd';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError, notifySuccess, notifyError } from '@/lib/feedback';
import { Fade, StaggerContainer, ListItemFade } from '@/components/animation/fade';
import { AnimatedCounter } from '@/components/animation/animated-counter';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { usePageLoadAnimation, useShakeAnimation, useClipboard } from '@/hooks/use-animation';

type ViewMode = 'list' | 'add' | 'edit';
type AddMode = 'single' | 'opml';

interface PreviewFeed {
  url: string;
  title: string;
  category?: string;
}

interface ImportProgress {
  phase: 'parsing' | 'validating' | 'creating' | 'completed';
  current: number;
  total: number;
  currentItem?: string;
  message: string;
  stats: {
    imported: number;
    skipped: number;
    failed: number;
  };
  backgroundTasks?: number;
}

const phaseLabels: Record<ImportProgress['phase'], string> = {
  parsing: '解析文件',
  validating: '验证订阅源',
  creating: '导入订阅源',
  completed: '完成',
};

const phaseIcons: Record<ImportProgress['phase'], React.ReactNode> = {
  parsing: <FileText className="h-4 w-4" />,
  validating: <Search className="h-4 w-4" />,
  creating: <Database className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
};

export function FeedsManagePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedIdParam = searchParams.get('feed');
  const editModeParam = searchParams.get('edit');
  const isLoaded = usePageLoadAnimation(100);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [addMode, setAddMode] = useState<AddMode>('single');
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isShaking, shake } = useShakeAnimation();
  // OPML 导入相关状态
  const [importContent, setImportContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
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
    backgroundTaskIds?: string[];
  } | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  // 表单状态
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSiteUrl, setFormSiteUrl] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formFetchInterval, setFormFetchInterval] = useState(3600);
  const [formPriority, setFormPriority] = useState(5);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 分页状态
  const [page, setPage] = useState(1);
  const pageLimit = 20;

  // 搜索时重置页码
  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: feedsData, isLoading, refetch } = trpc.feeds.list.useQuery({
    search: search || undefined,
    page,
    limit: pageLimit,
  });
  const { data: categories } = trpc.categories.list.useQuery();
  // 获取全局统计数据（用于统计卡片）
  const { data: globalStats } = trpc.feeds.globalStats.useQuery();

  const addFeed = trpc.feeds.add.useMutation();
  const updateFeed = trpc.feeds.update.useMutation();
  const deleteFeed = trpc.feeds.delete.useMutation();
  const bulkAction = trpc.feeds.bulkAction.useMutation();
  const discoverFeed = trpc.feeds.discover.useMutation();
  const refreshFeed = trpc.feeds.refresh.useMutation();

  // OPML 导入相关
  const { mutateAsync: previewOPML } = trpc.settings.previewOPML.useMutation();
  const { mutateAsync: importOPML } = trpc.settings.importOPML.useMutation();

  // 正在抓取的订阅源 ID 集合
  const [fetchingFeedIds, setFetchingFeedIds] = useState<Set<string>>(new Set());

  const feeds = feedsData?.items || [];

  // 根据 URL 参数初始化视图
  useEffect(() => {
    if (editModeParam === 'true' && feedIdParam) {
      setViewMode('edit');
      setEditingFeedId(feedIdParam);
    } else if (feedIdParam === 'add') {
      setViewMode('add');
    }
  }, [feedIdParam, editModeParam]);

  const { data: editingFeed } = trpc.feeds.byId.useQuery(
    { id: editingFeedId || '' },
    { enabled: !!editingFeedId }
  );

  useEffect(() => {
    if (editingFeed) {
      setFormUrl(editingFeed.feedUrl || '');
      setFormTitle(editingFeed.title);
      setFormDescription(editingFeed.description || '');
      setFormSiteUrl(editingFeed.siteUrl || '');
      setFormCategoryId(editingFeed.categoryId || '');
      setFormFetchInterval(editingFeed.fetchInterval);
      setFormPriority(editingFeed.priority);
      setFormIsActive(editingFeed.isActive);
    }
  }, [editingFeed]);

  const goToList = () => {
    setViewMode('list');
    setEditingFeedId(null);
    resetForm();
    setFormErrors({});
    router.push('/feeds/manage');
  };

  const goToAdd = () => {
    setViewMode('add');
    resetForm();
    setFormErrors({});
    router.push('/feeds/manage?feed=add');
  };

  const goToEdit = (id: string) => {
    setViewMode('edit');
    setEditingFeedId(id);
    router.push(`/feeds/manage?feed=${id}&edit=true`);
  };

  const resetForm = () => {
    setFormUrl('');
    setFormTitle('');
    setFormDescription('');
    setFormSiteUrl('');
    setFormCategoryId('');
    setFormFetchInterval(3600);
    setFormPriority(5);
    setFormIsActive(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formUrl.trim()) {
      errors.url = '请输入订阅地址';
    } else if (!formUrl.match(/^https?:\/\/.+/)) {
      errors.url = '请输入有效的 URL';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDiscover = async () => {
    if (!formUrl.trim()) {
      setFormErrors({ url: '请先输入订阅地址' });
      shake();
      return;
    }

    try {
      const result = await discoverFeed.mutateAsync({ url: formUrl });
      if (result.feed) {
        setFormTitle(result.feed.title || formTitle);
        setFormDescription(result.feed.description || formDescription);
        setFormSiteUrl(result.feed.siteUrl || formSiteUrl);
        notifySuccess('发现订阅源', '已自动填充订阅源信息');
      }
    } catch (error) {
      notifyError('发现失败', '无法自动发现订阅源信息');
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      shake();
      return;
    }

    try {
      if (viewMode === 'add') {
        await addFeed.mutateAsync({
          url: formUrl,
          title: formTitle || undefined,
          description: formDescription || undefined,
          siteUrl: formSiteUrl || undefined,
          categoryId: formCategoryId || undefined,
        });
        notifySuccess('添加成功', '订阅源已添加');
      } else if (viewMode === 'edit' && editingFeedId) {
        await updateFeed.mutateAsync({
          id: editingFeedId,
          url: formUrl,
          title: formTitle,
          description: formDescription,
          siteUrl: formSiteUrl,
          categoryId: formCategoryId || undefined,  // 空字符串转为 undefined，避免 UUID 验证错误
          fetchInterval: formFetchInterval,
          priority: formPriority,
          isActive: formIsActive,
        });
        notifySuccess('更新成功', '订阅源已更新');
      }
      refetch();
      goToList();
    } catch (error) {
      shake();
      notifyError('保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    Modal.confirm({
      title: '确认删除',
      content: (
        <div>
          <p>确定要删除订阅源 <span className="font-medium text-foreground">"{title}"</span> 吗？</p>
          <p className="text-sm text-muted-foreground mt-2">此操作不可恢复，相关的文章也将被删除。</p>
        </div>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteFeed.mutateAsync({ id });
          notifySuccess('删除成功');
          refetch();
        } catch (error) {
          notifyError('删除失败');
        }
      },
    });
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete' | 'refresh') => {
    if (selectedIds.size === 0) return;

    const actionConfig = {
      activate: { title: '启用订阅源', content: `确定要启用选中的 ${selectedIds.size} 个订阅源吗？` },
      deactivate: { title: '禁用订阅源', content: `确定要禁用选中的 ${selectedIds.size} 个订阅源吗？` },
      delete: { title: '删除订阅源', content: `确定要删除选中的 ${selectedIds.size} 个订阅源吗？此操作不可恢复。`, danger: true },
      refresh: { title: '刷新订阅源', content: `确定要刷新选中的 ${selectedIds.size} 个订阅源吗？` },
    }[action];

    Modal.confirm({
      title: actionConfig.title,
      content: actionConfig.content,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: actionConfig.danger },
      onOk: async () => {
        try {
          await bulkAction.mutateAsync({
            feedIds: Array.from(selectedIds),
            action,
          });
          setSelectedIds(new Set());
          notifySuccess('操作成功');
          refetch();
        } catch (error) {
          notifyError('操作失败');
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === feeds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(feeds.map((f: { id: string }) => f.id)));
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      notifySuccess('刷新成功');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // 手动抓取单个订阅源
  const handleFetchFeed = async (feedId: string, feedTitle: string) => {
    setFetchingFeedIds(prev => new Set(prev).add(feedId));

    try {
      await refreshFeed.mutateAsync({ id: feedId });
      notifySuccess('抓取任务已提交', `正在抓取「${feedTitle}」的新内容...`);

      // 3秒后刷新列表
      setTimeout(() => {
        refetch();
        setFetchingFeedIds(prev => {
          const next = new Set(prev);
          next.delete(feedId);
          return next;
        });
      }, 3000);
    } catch (error) {
      notifyError('抓取失败', error instanceof Error ? error.message : '请稍后重试');
      setFetchingFeedIds(prev => {
        const next = new Set(prev);
        next.delete(feedId);
        return next;
      });
    }
  };

  // ============== OPML 导入功能 ==============

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setImportContent(content);
      await handlePreview(content);
    };
    reader.readAsText(file);
  };

  // 预览 OPML
  const handlePreview = async (content: string) => {
    setIsPreviewing(true);
    try {
      const result = await previewOPML({ opmlContent: content });
      if (result.success) {
        setPreviewData({
          title: result.title,
          feeds: result.feeds,
          categories: result.categories,
        });
      } else {
        notifyError('解析失败', result.error || '无法解析 OPML 文件');
      }
    } catch (error) {
      notifyError('预览失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setIsPreviewing(false);
    }
  };

  // 执行导入
  const handleImport = async () => {
    if (!importContent) return;

    setIsImporting(true);
    setShowProgressModal(true);
    setProgress({
      phase: 'parsing',
      current: 0,
      total: previewData?.feeds.length || 0,
      message: '正在解析 OPML 文件...',
      stats: { imported: 0, skipped: 0, failed: 0 },
    });

    try {
      // 模拟进度更新
      setProgress(prev => prev ? {
        ...prev,
        phase: 'validating',
        message: '正在验证订阅源...',
      } : null);

      const result = await importOPML({ opmlContent: importContent });

      setProgress(prev => prev ? {
        ...prev,
        phase: 'creating',
        current: result.total,
        message: '正在导入订阅源...',
      } : null);

      setImportResult(result);

      // 完成状态
      setProgress(prev => prev ? {
        ...prev,
        phase: 'completed',
        current: result.total,
        message: `导入完成：成功 ${result.created}，跳过 ${result.skipped}，失败 ${result.failed}`,
        stats: {
          imported: result.created,
          skipped: result.skipped,
          failed: result.failed,
        },
      } : null);

      if (result.created > 0) {
        notifySuccess('导入成功', `已成功导入 ${result.created} 个订阅源`);
        refetch();
      }
    } catch (error) {
      setProgress(prev => prev ? {
        ...prev,
        phase: 'completed',
        message: '导入失败',
        stats: prev.stats,
      } : null);
      notifyError('导入失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setIsImporting(false);
    }
  };

  // 重置导入状态
  const resetImport = () => {
    setImportContent('');
    setPreviewData(null);
    setImportResult(null);
    setProgress(null);
    setShowProgressModal(false);
  };

  // 关闭进度弹窗
  const handleCloseProgressModal = () => {
    if (!isImporting) {
      setShowProgressModal(false);
      if (progress?.phase === 'completed') {
        resetImport();
        goToList();
      }
    }
  };

  // ============== 结束 OPML 导入功能 ==============

  // 列表视图
  if (viewMode === 'list') {
    return (
      <Fade in={isLoaded} duration={400}>
        <div className="min-h-screen bg-background">
          {/* 顶部导航栏 */}
          <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex h-full items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Tooltip title="返回主页">
                  <Button
                    type="text"
                    icon={<ArrowLeft className="h-5 w-5" />}
                    onClick={() => router.push('/')}
                    className="hover:bg-muted/50"
                  />
                </Tooltip>
                <div>
                  <h1 className="font-semibold text-sm">订阅源管理</h1>
                  <p className="text-xs text-muted-foreground">
                    {globalStats?.totalFeeds ?? feedsData?.pagination?.total ?? 0} 个订阅源 · {globalStats?.totalEntries ?? 0} 篇文章
                  </p>
                </div>
              </div>
              <Space>
                <Tooltip title="刷新列表">
                  <Button
                    icon={<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />}
                    onClick={handleRefreshAll}
                    loading={isRefreshing}
                  />
                </Tooltip>
                <Button
                  type="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={goToAdd}
                  className="shadow-sm"
                >
                  添加订阅源
                </Button>
              </Space>
            </div>
          </header>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {/* 统计卡片 - 使用全局统计数据 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Card className="border-border/60" size="small">
                <AnimatedCounter
                  value={globalStats?.totalFeeds ?? 0}
                  label="订阅源总数"
                  icon={<Rss className="h-4 w-4 text-primary" />}
                />
              </Card>
              <Card className="border-border/60" size="small">
                <AnimatedCounter
                  value={globalStats?.activeFeeds ?? 0}
                  label="启用中"
                  icon={<Check className="h-4 w-4 text-green-500" />}
                />
              </Card>
              <Card className="border-border/60" size="small">
                <AnimatedCounter
                  value={globalStats?.inactiveFeeds ?? 0}
                  label="已禁用"
                  icon={<X className="h-4 w-4 text-red-500" />}
                />
              </Card>
              <Card className="border-border/60" size="small">
                <AnimatedCounter
                  value={globalStats?.totalEntries ?? 0}
                  label="文章总数"
                  icon={<FolderOpen className="h-4 w-4 text-blue-500" />}
                />
              </Card>
              <Card className="border-border/60" size="small">
                <AnimatedCounter
                  value={globalStats?.unreadCount ?? 0}
                  label="未读文章"
                  icon={<FolderOpen className="h-4 w-4 text-orange-500" />}
                />
              </Card>
            </div>

            {/* 搜索框 */}
            <div className="mb-6">
              <Input
                size="large"
                placeholder="搜索订阅源..."
                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                className="max-w-md"
              />
            </div>

            {/* 批量操作栏 */}
            {selectedIds.size > 0 && (
              <Fade in direction="down" duration={200}>
                <Card className="mb-4 border-primary/20 bg-primary/5" size="small">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      已选择 <span className="font-semibold text-primary">{selectedIds.size}</span> 个订阅源
                    </span>
                    <div className="flex-1" />
                    <Space size="small">
                      <Button
                        size="small"
                        icon={<RefreshCw className="h-3 w-3" />}
                        onClick={() => handleBulkAction('refresh')}
                      >
                        刷新
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleBulkAction('activate')}
                        className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"
                      >
                        启用
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleBulkAction('deactivate')}
                        className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20"
                      >
                        禁用
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<Trash2 className="h-3 w-3" />}
                        onClick={() => handleBulkAction('delete')}
                      >
                        删除
                      </Button>
                    </Space>
                  </div>
                </Card>
              </Fade>
            )}

            {/* 订阅源列表 */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Card key={i} size="small" loading />
                ))}
              </div>
            ) : feeds.length === 0 ? (
              <EmptyState
                icon={<Rss className="w-8 h-8" />}
                title={search ? '没有找到匹配的订阅源' : '还没有订阅源'}
                description={search ? '尝试使用其他关键词搜索' : '添加您的第一个订阅源，开始追踪感兴趣的内容'}
                action={!search ? { label: '添加订阅源', onClick: goToAdd } : undefined}
              />
            ) : (
              <Card className="overflow-hidden" styles={{ body: { padding: 0 } }}>
                {/* 表头 */}
                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-muted/30 font-medium text-xs border-b border-border/60">
                  <div className="col-span-1 flex items-center">
                    {(() => {
                      const allSelected = selectedIds.size === feeds.length;
                      const someSelected = selectedIds.size > 0;
                      return (
                        <div
                          key={allSelected ? 'all' : someSelected ? 'some' : 'none'}
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all',
                            allSelected 
                              ? 'bg-primary border-2 border-primary' 
                              : someSelected
                                ? 'bg-primary/20 border-2 border-primary'
                                : 'border-2 border-muted-foreground/30 hover:border-primary/50'
                          )}
                          onClick={toggleSelectAll}
                        >
                          {allSelected && (
                            <Check className="h-3 w-3 text-black" strokeWidth={3} />
                          )}
                          {someSelected && !allSelected && (
                            <div className="w-2 h-2 rounded-sm bg-primary" />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="col-span-4">订阅源</div>
                  <div className="col-span-2">分类</div>
                  <div className="col-span-2">上次获取</div>
                  <div className="col-span-1 text-center">文章</div>
                  <div className="col-span-1 text-center">状态</div>
                  <div className="col-span-1 text-right">操作</div>
                </div>

                {/* 列表项 */}
                {feeds.map((feed, index) => {
                  const category = categories?.find((c: { id: string }) => c.id === feed.categoryId);
                  const isSelected = selectedIds.has(feed.id);

                  return (
                    <ListItemFade key={feed.id} index={index} baseDelay={30}>
                      <div
                        className={cn(
                          'grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-primary/[0.02] transition-colors border-b border-border/40 last:border-0 cursor-pointer',
                          !feed.isActive && 'opacity-60 bg-muted/10'
                        )}
                        onClick={() => toggleSelect(feed.id)}
                      >
                        {/* 复选框 - 阻止冒泡避免重复触发 */}
                        <div 
                          className="col-span-1 flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            key={isSelected ? 'selected' : 'unselected'}
                            className={cn(
                              'w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all',
                              isSelected 
                                ? 'bg-primary border-2 border-primary' 
                                : 'border-2 border-muted-foreground/30 hover:border-primary/50'
                            )}
                            onClick={() => toggleSelect(feed.id)}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-black" strokeWidth={3} />
                            )}
                          </div>
                        </div>

                        {/* 订阅源信息 - 阻止冒泡 */}
                        <div 
                          className="col-span-4 flex items-center gap-2.5 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {feed.iconUrl ? (
                            <img src={feed.iconUrl} alt="" className="w-8 h-8 rounded-lg shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                              <Rss className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{feed.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {feed.feedUrl}
                            </div>
                          </div>
                        </div>

                        {/* 分类 - 阻止冒泡 */}
                        <div 
                          className="col-span-2 flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {category ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium" style={{
                              backgroundColor: `${category.color || '#94a3b8'}15`,
                              color: category.color || '#94a3b8',
                            }}>
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: category.color || '#94a3b8' }} />
                              <span className="truncate">{category.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">未分类</span>
                          )}
                        </div>

                        {/* 上次获取时间 - 阻止冒泡 */}
                        <div
                          className="col-span-2 flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {feed.lastError ? (
                            <Tooltip
                              title={
                                <div className="space-y-1">
                                  <div>最后错误: {feed.lastError}</div>
                                  {feed.lastFetchedAt && (
                                    <div>尝试时间: {formatDate(feed.lastFetchedAt)}</div>
                                  )}
                                  {(feed.errorCount || 0) > 1 && (
                                    <div>连续失败: {feed.errorCount} 次</div>
                                  )}
                                </div>
                              }
                            >
                              <div className="flex items-center gap-1 text-xs text-red-500">
                                <AlertCircle className="h-3 w-3" />
                                <span>错误 x{feed.errorCount}</span>
                              </div>
                            </Tooltip>
                          ) : feed.lastFetchedAt ? (
                            <Tooltip title={
                              <div className="space-y-1">
                                <div>获取时间: {formatDate(feed.lastFetchedAt)}</div>
                                {feed.lastSuccessAt && (
                                  <div>成功时间: {formatDate(feed.lastSuccessAt)}</div>
                                )}
                              </div>
                            }>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(feed.lastFetchedAt)}
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title="尚未抓取">
                              <span className="text-xs text-muted-foreground">尚未抓取</span>
                            </Tooltip>
                          )}
                        </div>

                        {/* 文章数量 - 阻止冒泡 */}
                        <div 
                          className="col-span-1 flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip title={`总文章: ${feed._count?.entries || 0}${(feed.unreadCount || 0) > 0 ? `, 未读: ${feed.unreadCount}` : ''}`}>
                            <div className="text-center">
                              <span className="text-sm font-medium">{feed._count?.entries || 0}</span>
                              {(feed.unreadCount || 0) > 0 && (
                                <span className="text-xs text-primary ml-1">({feed.unreadCount})</span>
                              )}
                            </div>
                          </Tooltip>
                        </div>

                        {/* 状态 - 阻止冒泡 */}
                        <div 
                          className="col-span-1 flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {feed.isActive ? (
                            <StatusBadge status="success" pulse>
                              启用
                            </StatusBadge>
                          ) : (
                            <StatusBadge status="error">
                              禁用
                            </StatusBadge>
                          )}
                        </div>

                        {/* 操作按钮 - 阻止冒泡 */}
                        <div
                          className="col-span-1 flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip title="手动抓取">
                            <Button
                              type="text"
                              size="small"
                              icon={fetchingFeedIds.has(feed.id)
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />
                              }
                              onClick={() => handleFetchFeed(feed.id, feed.title)}
                              disabled={fetchingFeedIds.has(feed.id)}
                              className="hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                            />
                          </Tooltip>
                          <Tooltip title="编辑">
                            <Button
                              type="text"
                              size="small"
                              icon={<Edit className="h-3.5 w-3.5" />}
                              onClick={() => goToEdit(feed.id)}
                              className="hover:bg-primary/10 hover:text-primary transition-colors"
                            />
                          </Tooltip>
                          <Tooltip title="删除">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() => handleDelete(feed.id, feed.title)}
                              className="hover:bg-red-500/10"
                            />
                          </Tooltip>
                        </div>
                      </div>
                    </ListItemFade>
                  );
                })}
              </Card>
            )}

            {/* 分页组件 */}
            {feedsData?.pagination && feedsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 mt-4">
                <div className="text-sm text-muted-foreground">
                  共 {feedsData.pagination.total} 个订阅源，第 {page} / {feedsData.pagination.totalPages} 页
                </div>
                <Space>
                  <Button
                    size="small"
                    disabled={page === 1 || isLoading}
                    onClick={() => setPage(page - 1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    上一页
                  </Button>
                  <Button
                    size="small"
                    disabled={!feedsData.pagination.hasNext || isLoading}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Space>
              </div>
            )}
          </div>
        </div>
      </Fade>
    );
  }

  // 添加/编辑视图
  return (
    <Fade in duration={300}>
      <div className="min-h-screen bg-background">
        {/* 顶部导航栏 */}
        <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Tooltip title="返回列表">
                <Button
                  type="text"
                  icon={<ArrowLeft className="h-5 w-5" />}
                  onClick={goToList}
                  className="hover:bg-muted/50"
                />
              </Tooltip>
              <h1 className="font-semibold text-sm">
                {viewMode === 'add' ? '添加订阅源' : '编辑订阅源'}
              </h1>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          {/* 编辑模式：直接显示表单 */}
          {viewMode === 'edit' && (
            <Card
              className={cn('border-border/60', isShaking && 'animate-shake')}
              title={
                <div className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-primary" />
                  <span>修改订阅源信息</span>
                </div>
              }
            >
              <Space direction="vertical" size="large" className="w-full">
                {/* RSS 订阅地址 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium">
                      RSS 订阅地址 <span className="text-red-500">*</span>
                    </label>
                    {formErrors.url && (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.url}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/rss"
                      value={formUrl}
                      onChange={(e) => {
                        setFormUrl(e.target.value);
                        if (formErrors.url) setFormErrors({});
                      }}
                      prefix={<Rss className="h-4 w-4 text-muted-foreground" />}
                      status={formErrors.url ? 'error' : ''}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleDiscover}
                      loading={discoverFeed.isPending}
                      icon={<Zap className="h-4 w-4" />}
                    >
                      自动发现
                    </Button>
                  </div>
                </div>

                {/* 标题 */}
                <div>
                  <div className="mb-2">
                    <label className="text-sm font-medium">标题</label>
                  </div>
                  <Input
                    placeholder="订阅源标题（留空则自动获取）"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                {/* 描述 */}
                <div>
                  <div className="mb-2">
                    <label className="text-sm font-medium">描述</label>
                  </div>
                  <Input.TextArea
                    rows={3}
                    placeholder="订阅源描述"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* 网站地址 */}
                <div>
                  <div className="mb-2">
                    <label className="text-sm font-medium">网站地址</label>
                  </div>
                  <Input
                    placeholder="https://example.com"
                    value={formSiteUrl}
                    onChange={(e) => setFormSiteUrl(e.target.value)}
                    prefix={<Globe className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>

                {/* 分类 */}
                <div>
                  <div className="mb-2">
                    <label className="text-sm font-medium">分类</label>
                  </div>
                  <Select
                    className="w-full"
                    placeholder="选择分类"
                    allowClear
                    value={formCategoryId || undefined}
                    onChange={(value) => setFormCategoryId(value || '')}
                    options={categories?.map((cat: { id: string; name: string; color?: string | null }) => ({
                      label: (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color || '#94a3b8' }}
                          />
                          <span className="truncate">{cat.name}</span>
                        </div>
                      ),
                      value: cat.id,
                    }))}
                  />
                </div>

                {/* 高级设置 */}
                <div className="border-t border-border/60 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">高级设置</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 更新频率 */}
                    <div>
                      <div className="mb-2">
                        <label className="text-sm font-medium">更新频率</label>
                      </div>
                      <Select
                        value={formFetchInterval}
                        onChange={setFormFetchInterval}
                        className="w-full"
                        options={[
                          { label: '15 分钟', value: 900 },
                          { label: '30 分钟', value: 1800 },
                          { label: '1 小时', value: 3600 },
                          { label: '2 小时', value: 7200 },
                          { label: '6 小时', value: 21600 },
                          { label: '12 小时', value: 43200 },
                          { label: '24 小时', value: 86400 },
                        ]}
                      />
                    </div>

                    {/* 优先级 */}
                    <div>
                      <div className="mb-2">
                        <label className="text-sm font-medium">优先级</label>
                      </div>
                      <Select
                        value={formPriority}
                        onChange={setFormPriority}
                        className="w-full"
                        options={[
                          { label: '低', value: 1 },
                          { label: '中', value: 5 },
                          { label: '高', value: 10 },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* 启用状态 */}
                <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-xl">
                  <div>
                    <div className="font-medium text-sm">启用此订阅源</div>
                    <div className="text-xs text-muted-foreground">禁用后将不再获取新文章</div>
                  </div>
                  <Switch
                    checked={formIsActive}
                    onChange={setFormIsActive}
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4 border-t border-border/60">
                  <Button onClick={goToList} size="large">
                    取消
                  </Button>
                  <Button
                    type="primary"
                    icon={<Save className="h-4 w-4" />}
                    onClick={handleSave}
                    loading={updateFeed.isPending}
                    size="large"
                    className="flex-1"
                  >
                    保存更改
                  </Button>
                </div>
              </Space>
            </Card>
          )}

          {/* 添加模式：使用 Tabs 切换单个添加和 OPML 导入 */}
          {viewMode === 'add' && (
            <Tabs
              defaultActiveKey="single"
              activeKey={addMode}
              onChange={(key) => {
                setAddMode(key as AddMode);
                resetImport();
              }}
              items={[
                {
                  key: 'single',
                  label: (
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      单个添加
                    </span>
                  ),
                  children: (
                    <Card className="border-border/60" styles={{ body: { paddingTop: 16 } }}>
                      <Space direction="vertical" size="large" className="w-full">
                        {/* RSS 订阅地址 */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <label className="text-sm font-medium">
                              RSS 订阅地址 <span className="text-red-500">*</span>
                            </label>
                            {formErrors.url && (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {formErrors.url}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="https://example.com/rss"
                              value={formUrl}
                              onChange={(e) => {
                                setFormUrl(e.target.value);
                                if (formErrors.url) setFormErrors({});
                              }}
                              prefix={<Rss className="h-4 w-4 text-muted-foreground" />}
                              status={formErrors.url ? 'error' : ''}
                              className="flex-1"
                            />
                            <Button
                              onClick={handleDiscover}
                              loading={discoverFeed.isPending}
                              icon={<Zap className="h-4 w-4" />}
                            >
                              自动发现
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            输入 RSS 或 Atom 订阅地址，点击"自动发现"可以自动获取订阅源信息
                          </p>
                        </div>

                        {/* 标题 */}
                        <div>
                          <div className="mb-2">
                            <label className="text-sm font-medium">标题</label>
                          </div>
                          <Input
                            placeholder="订阅源标题（留空则自动获取）"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                          />
                        </div>

                        {/* 描述 */}
                        <div>
                          <div className="mb-2">
                            <label className="text-sm font-medium">描述</label>
                          </div>
                          <Input.TextArea
                            rows={3}
                            placeholder="订阅源描述"
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                          />
                        </div>

                        {/* 网站地址 */}
                        <div>
                          <div className="mb-2">
                            <label className="text-sm font-medium">网站地址</label>
                          </div>
                          <Input
                            placeholder="https://example.com"
                            value={formSiteUrl}
                            onChange={(e) => setFormSiteUrl(e.target.value)}
                            prefix={<Globe className="h-4 w-4 text-muted-foreground" />}
                          />
                        </div>

                        {/* 分类 */}
                        <div>
                          <div className="mb-2">
                            <label className="text-sm font-medium">分类</label>
                          </div>
                          <Select
                            className="w-full"
                            placeholder="选择分类"
                            allowClear
                            value={formCategoryId || undefined}
                            onChange={(value) => setFormCategoryId(value || '')}
                            options={categories?.map((cat: { id: string; name: string; color?: string | null }) => ({
                              label: (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: cat.color || '#94a3b8' }}
                                  />
                                  <span className="truncate">{cat.name}</span>
                                </div>
                              ),
                              value: cat.id,
                            }))}
                          />
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-3 pt-4 border-t border-border/60">
                          <Button onClick={goToList} size="large">
                            取消
                          </Button>
                          <Button
                            type="primary"
                            icon={<Save className="h-4 w-4" />}
                            onClick={handleSave}
                            loading={addFeed.isPending}
                            size="large"
                            className="flex-1"
                          >
                            添加订阅源
                          </Button>
                        </div>
                      </Space>
                    </Card>
                  ),
                },
                {
                  key: 'opml',
                  label: (
                    <span className="flex items-center gap-2">
                      <UploadIcon className="h-4 w-4" />
                      OPML 导入
                    </span>
                  ),
                  children: (
                    <Card className="border-border/60" styles={{ body: { paddingTop: 16 } }}>
                      <Space direction="vertical" size="large" className="w-full">
                        {/* 上传区域 */}
                        <div>
                          <div className="mb-2">
                            <label className="text-sm font-medium">上传 OPML 文件</label>
                          </div>
                          <Upload.Dragger
                            accept=".opml,.xml"
                            showUploadList={false}
                            beforeUpload={(file: File) => {
                              handleFileUpload(file);
                              return false;
                            }}
                            className="bg-muted/30"
                          >
                            <p className="ant-upload-drag-icon">
                              <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                            </p>
                            <p className="ant-upload-text text-sm">点击或拖拽文件到此区域上传</p>
                            <p className="ant-upload-hint text-xs text-muted-foreground">
                              支持 OPML 和 XML 格式的订阅源导出文件
                            </p>
                          </Upload.Dragger>
                        </div>

                        {/* 预览数据 */}
                        {previewData && (
                          <div className="border border-border/60 rounded-xl overflow-hidden">
                            <div className="bg-muted/30 px-4 py-3 border-b border-border/60">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Database className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-sm">{previewData.title}</span>
                                </div>
                                <Button size="small" onClick={resetImport}>
                                  清除
                                </Button>
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="flex gap-4 mb-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Rss className="h-4 w-4 text-primary" />
                                  <span>{previewData.feeds.length} 个订阅源</span>
                                </div>
                                {previewData.categories.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <FolderOpen className="h-4 w-4 text-blue-500" />
                                    <span>{previewData.categories.length} 个分类</span>
                                  </div>
                                )}
                              </div>

                              {/* 订阅源列表 */}
                              <div className="max-h-60 overflow-y-auto space-y-2">
                                {previewData.feeds.slice(0, 20).map((feed, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm"
                                  >
                                    <Rss className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="truncate flex-1">{feed.title}</span>
                                    {feed.category && (
                                      <Tag className="text-xs m-0">{feed.category}</Tag>
                                    )}
                                  </div>
                                ))}
                                {previewData.feeds.length > 20 && (
                                  <div className="text-center text-xs text-muted-foreground py-2">
                                    还有 {previewData.feeds.length - 20} 个订阅源...
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 导入结果 */}
                        {importResult && (
                          <div className="border border-border/60 rounded-xl p-4 bg-muted/30">
                            <div className="flex items-center gap-4 mb-4">
                              {importResult.success ? (
                                <CheckCircle className="h-6 w-6 text-green-500" />
                              ) : (
                                <XCircle className="h-6 w-6 text-red-500" />
                              )}
                              <div>
                                <div className="font-medium">
                                  {importResult.success ? '导入完成' : '导入失败'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  成功 {importResult.created} · 跳过 {importResult.skipped} · 失败{' '}
                                  {importResult.failed}
                                </div>
                              </div>
                            </div>
                            <Button onClick={() => { resetImport(); goToList(); }}>
                              返回列表
                            </Button>
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex gap-3 pt-4 border-t border-border/60">
                          <Button onClick={goToList} size="large" disabled={isImporting}>
                            取消
                          </Button>
                          <Button
                            type="primary"
                            icon={<ArrowRight className="h-4 w-4" />}
                            onClick={handleImport}
                            loading={isImporting}
                            disabled={!previewData || isImporting}
                            size="large"
                            className="flex-1"
                          >
                            {isImporting ? '正在导入...' : '开始导入'}
                          </Button>
                        </div>
                      </Space>
                    </Card>
                  ),
                },
              ]}
            />
          )}

          {/* 支持格式说明 */}
          {viewMode === 'add' && addMode === 'single' && (
            <Card className="mt-6 bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/10" size="small">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Rss className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm mb-2">支持的订阅格式</div>
                  <div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" /> RSS 1.0 / 2.0
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" /> Atom 1.0
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" /> RDF
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" /> JSON Feed
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* 导入进度弹窗 */}
        <Modal
          open={showProgressModal}
          onCancel={handleCloseProgressModal}
          footer={null}
          closable={!isImporting}
          maskClosable={false}
          title={
            <div className="flex items-center gap-2">
              {progress?.phase === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              <span>导入进度</span>
            </div>
          }
        >
          {progress && (
            <div className="space-y-4">
              {/* 阶段指示器 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {phaseIcons[progress.phase]}
                  <span className="font-medium">{phaseLabels[progress.phase]}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>

              {/* 进度条 */}
              <Progress
                percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                status={progress.phase === 'completed' ? 'success' : 'active'}
              />

              {/* 当前项 */}
              {progress.currentItem && (
                <div className="text-sm text-muted-foreground truncate">
                  当前: {progress.currentItem}
                </div>
              )}

              {/* 消息 */}
              <div className="text-sm">{progress.message}</div>

              {/* 统计 */}
              {progress.phase === 'completed' && (
                <div className="flex gap-4 pt-2">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">成功: {progress.stats.imported}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <SkipForward className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">跳过: {progress.stats.skipped}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">失败: {progress.stats.failed}</span>
                  </div>
                </div>
              )}

              {/* 关闭按钮 */}
              {progress.phase === 'completed' && (
                <Button type="primary" block onClick={handleCloseProgressModal}>
                  完成
                </Button>
              )}
            </div>
          )}
        </Modal>
      </div>
    </Fade>
  );
}
