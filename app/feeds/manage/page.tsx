/**
 * 订阅源管理页面 - 统一管理所有订阅源操作
 * 功能：添加、查看、编辑订阅源
 */

'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button, Input, Card, Space, Modal, Badge, Tag, Tooltip, Switch, Select, Empty, Tabs } from 'antd';
import type { MenuProps } from 'antd';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError, notifySuccess, notifyError } from '@/lib/feedback';

type ViewMode = 'list' | 'add' | 'edit';

export default function FeedsManagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedIdParam = searchParams.get('feed');
  const editModeParam = searchParams.get('edit');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 表单状态
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSiteUrl, setFormSiteUrl] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formFetchInterval, setFormFetchInterval] = useState(3600);
  const [formPriority, setFormPriority] = useState(5);
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: feedsData, isLoading, refetch } = trpc.feeds.list.useQuery({
    search: search || undefined,
  });
  const { data: categories } = trpc.categories.list.useQuery();

  const addFeed = trpc.feeds.add.useMutation();
  const updateFeed = trpc.feeds.update.useMutation();
  const deleteFeed = trpc.feeds.delete.useMutation();
  const bulkAction = trpc.feeds.bulkAction.useMutation();
  const discoverFeed = trpc.feeds.discover.useMutation();

  const feeds = feedsData?.items || [];

  // 根据 URL 参数初始化视图
  useEffect(() => {
    if (editModeParam === 'true' && feedIdParam) {
      setViewMode('edit');
      setEditingFeedId(feedIdParam);
      loadFeedForEdit(feedIdParam);
    } else if (feedIdParam === 'add') {
      setViewMode('add');
    }
  }, [feedIdParam, editModeParam]);

  const loadFeedForEdit = async (id: string) => {
    try {
      const feed = await trpc.feeds.byId.fetch({ id });
      if (feed) {
        setFormUrl(feed.feedUrl || '');
        setFormTitle(feed.title);
        setFormDescription(feed.description || '');
        setFormSiteUrl(feed.siteUrl || '');
        setFormCategoryId(feed.categoryId || '');
        setFormFetchInterval(feed.fetchInterval);
        setFormPriority(feed.priority);
        setFormIsActive(feed.isActive);
      }
    } catch (error) {
      notifyError('加载失败', '无法加载订阅源信息');
      goToList();
    }
  };

  const goToList = () => {
    setViewMode('list');
    setEditingFeedId(null);
    resetForm();
    router.push('/feeds/manage');
  };

  const goToAdd = () => {
    setViewMode('add');
    resetForm();
    router.push('/feeds/manage?feed=add');
  };

  const goToEdit = (id: string) => {
    setViewMode('edit');
    setEditingFeedId(id);
    loadFeedForEdit(id);
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

  const handleDiscover = async () => {
    if (!formUrl.trim()) return;

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
    if (!formUrl.trim()) {
      notifyError('验证失败', '请输入订阅地址');
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
          feedUrl: formUrl,
          title: formTitle,
          description: formDescription,
          siteUrl: formSiteUrl,
          categoryId: formCategoryId,
          fetchInterval: formFetchInterval,
          priority: formPriority,
          isActive: formIsActive,
        });
        notifySuccess('更新成功', '订阅源已更新');
      }
      refetch();
      goToList();
    } catch (error) {
      notifyError('保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此订阅源吗？此操作不可恢复。',
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

    const confirmMsg = {
      activate: '确定要启用这些订阅源吗？',
      deactivate: '确定要禁用这些订阅源吗？',
      delete: '确定要删除这些订阅源吗？此操作不可恢复。',
      refresh: '确定要刷新这些订阅源吗？',
    }[action];

    Modal.confirm({
      title: '确认操作',
      content: confirmMsg,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: action === 'delete' },
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
      setSelectedIds(new Set(feeds.map((f) => f.id)));
    }
  };

  // 列表视图
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-background">
        {/* 顶部导航栏 */}
        <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Button
                type="text"
                icon={<ArrowLeft className="h-5 w-5" />}
                onClick={() => router.push('/')}
                title="返回主页"
              />
              <h1 className="font-semibold text-sm">订阅源管理</h1>
            </div>
            <Button
              type="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={goToAdd}
              className="shadow-sm"
            >
              添加订阅源
            </Button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* 搜索框 */}
          <div className="mb-6">
            <Input
              size="large"
              placeholder="搜索订阅源..."
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </div>

          {/* 批量操作栏 */}
          {selectedIds.size > 0 && (
            <Card className="mb-6 border-primary/20 bg-primary/5" size="small">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {selectedIds.size === feeds.length ? (
                    <CheckSquare
                      className="h-5 w-5 cursor-pointer"
                      onClick={toggleSelectAll}
                    />
                  ) : (
                    <Square
                      className="h-5 w-5 cursor-pointer"
                      onClick={toggleSelectAll}
                    />
                  )}
                  <span className="text-sm">
                    已选择 <span className="font-semibold text-primary">{selectedIds.size}</span> / {feeds.length} 个订阅源
                  </span>
                </div>
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
                    className="bg-green-500/10 text-green-600 hover:bg-green-500/20"
                  >
                    启用
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleBulkAction('deactivate')}
                    className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
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
          )}

          {/* 订阅源列表 */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} size="small" loading />
              ))}
            </div>
          ) : feeds.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={search ? '没有找到匹配的订阅源' : '还没有订阅源'}
            >
              {!search && (
                <Button
                  type="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={goToAdd}
                >
                  添加订阅源
                </Button>
              )}
            </Empty>
          ) : (
            <Card className="divide-y divide-border/60" styles={{ body: { padding: 0 } }}>
              {/* 表头 */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-muted/30 font-medium text-sm">
                <div className="col-span-1">
                  {selectedIds.size === feeds.length ? (
                    <CheckSquare
                      className="h-5 w-5 cursor-pointer"
                      onClick={toggleSelectAll}
                    />
                  ) : (
                    <Square
                      className="h-5 w-5 cursor-pointer"
                      onClick={toggleSelectAll}
                    />
                  )}
                </div>
                <div className="col-span-5">订阅源</div>
                <div className="col-span-2">分类</div>
                <div className="col-span-2">状态</div>
                <div className="col-span-2">操作</div>
              </div>

              {/* 列表项 */}
              {feeds.map((feed) => {
                const category = categories?.find((c) => c.id === feed.categoryId);

                return (
                  <div
                    key={feed.id}
                    className={cn(
                      'grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-primary/[0.02] transition-colors',
                      !feed.isActive && 'opacity-50'
                    )}
                  >
                    <div className="col-span-1">
                      <div
                        className={cn(
                          'w-5 h-5 rounded border-2 cursor-pointer flex items-center justify-center transition-colors',
                          selectedIds.has(feed.id)
                            ? 'bg-primary border-primary text-white'
                            : 'border-muted-foreground/30 hover:border-primary/50'
                        )}
                        onClick={() => toggleSelect(feed.id)}
                      >
                        {selectedIds.has(feed.id) && (
                          <CheckSquare className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      {feed.iconUrl ? (
                        <img src={feed.iconUrl} alt="" className="w-8 h-8 rounded-lg" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Rss className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{feed.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {feed.feedUrl}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      {category ? (
                        <Tag
                          icon={<FolderOpen className="h-3 w-3" />}
                          style={{
                            backgroundColor: `${category.color || '#94a3b8'}20`,
                            color: category.color || '#94a3b8',
                          }}
                        >
                          {category.name}
                        </Tag>
                      ) : (
                        <span className="text-sm text-muted-foreground">未分类</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Tag
                        color={feed.isActive ? 'success' : 'default'}
                        className="rounded-full"
                      >
                        {feed.isActive ? '启用' : '禁用'}
                      </Tag>
                    </div>

                    <div className="col-span-2 flex items-center gap-1">
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          size="small"
                          icon={<Edit className="h-4 w-4" />}
                          onClick={() => goToEdit(feed.id)}
                          className="hover:bg-primary/10"
                        />
                      </Tooltip>
                      <Tooltip title="删除">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => handleDelete(feed.id)}
                        />
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    );
  }

  // 添加/编辑视图
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={<ArrowLeft className="h-5 w-5" />}
              onClick={goToList}
              title="返回列表"
            />
            <h1 className="font-semibold text-sm">
              {viewMode === 'add' ? '添加订阅源' : '编辑订阅源'}
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <Space direction="vertical" size="large" className="w-full">
            {/* RSS 订阅地址 */}
            <div>
              <div className="mb-2">
                <label className="text-sm text-muted-foreground">RSS 订阅地址 *</label>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/rss"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  prefix={<Rss className="h-4 w-4 text-muted-foreground" />}
                />
                <Button onClick={handleDiscover} loading={discoverFeed.isPending}>
                  自动发现
                </Button>
              </div>
            </div>

            {/* 标题 */}
            <div>
              <div className="mb-2">
                <label className="text-sm text-muted-foreground">标题</label>
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
                <label className="text-sm text-muted-foreground">描述</label>
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
                <label className="text-sm text-muted-foreground">网站地址</label>
              </div>
              <Input
                placeholder="https://example.com"
                value={formSiteUrl}
                onChange={(e) => setFormSiteUrl(e.target.value)}
              />
            </div>

            {/* 分类 */}
            <div>
              <div className="mb-2">
                <label className="text-sm text-muted-foreground">分类</label>
              </div>
              <select
                className="w-full h-10 px-3 rounded-md border border-border/60 bg-background"
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
              >
                <option value="">不分类</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 编辑模式下显示的额外选项 */}
            {viewMode === 'edit' && (
              <>
                {/* 更新频率 */}
                <div>
                  <div className="mb-2">
                    <label className="text-sm text-muted-foreground">更新频率</label>
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
                    <label className="text-sm text-muted-foreground">优先级</label>
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

                {/* 启用状态 */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">启用此订阅源</div>
                  </div>
                  <Switch checked={formIsActive} onChange={setFormIsActive} />
                </div>
              </>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <Button onClick={goToList}>
                取消
              </Button>
              <Button
                type="primary"
                icon={<Save className="h-4 w-4" />}
                onClick={handleSave}
                loading={addFeed.isPending || updateFeed.isPending}
              >
                {viewMode === 'add' ? '添加' : '保存'}
              </Button>
            </div>
          </Space>
        </Card>

        {/* 支持格式说明 */}
        {viewMode === 'add' && (
          <Card className="mt-6 bg-muted/30 border-border/40" size="small">
            <div className="flex items-start gap-3">
              <div className="text-primary">
                <Rss className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium text-sm mb-2">支持的格式</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• RSS 1.0 / 2.0</div>
                  <div>• Atom 1.0</div>
                  <div>• RDF</div>
                  <div>• JSON Feed</div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
