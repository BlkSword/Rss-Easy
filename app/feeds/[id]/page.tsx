/**
 * 订阅源详情页面 - 全屏布局
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Rss,
  ExternalLink,
  RefreshCw,
  Settings,
  Trash2,
  Info,
  Edit,
} from 'lucide-react';
import { Button, Card, Row, Col, Statistic, Spin, Empty, Dropdown, Modal, Input, Select, Switch, Space, Form, message } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/providers/sidebar-provider';

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const feedId = params.id as string;
  const { isCollapsed, toggleSidebar } = useSidebar();

  const { data: feed, isLoading, refetch } = trpc.feeds.byId.useQuery({ id: feedId });
  const updateMutation = trpc.feeds.update.useMutation();
  const deleteMutation = trpc.feeds.delete.useMutation();
  const refreshMutation = trpc.feeds.refresh.useMutation();
  const { data: categories } = trpc.categories.list.useQuery();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isCollapsed ? 'hidden lg:hidden' : 'block'
          )}>
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Spin size="large" />
          </main>
        </div>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isCollapsed ? 'hidden lg:hidden' : 'block'
          )}>
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Empty description="订阅源不存在" />
          </main>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync({ id: feedId });
      refetch();
      handleApiSuccess('刷新成功', '订阅源已更新');
    } catch (error) {
      handleApiError(error, '刷新失败');
    }
  };

  const handleDelete = async () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除订阅源"${feed.title}"吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync({ id: feedId });
          handleApiSuccess('删除成功');
          router.push('/feeds');
        } catch (error) {
          handleApiError(error, '删除失败');
        }
      },
    });
  };

  const handleEditSubmit = async (values: any) => {
    try {
      await updateMutation.mutateAsync({
        id: feedId,
        ...values,
      });
      handleApiSuccess('更新成功');
      setIsEditModalOpen(false);
      refetch();
    } catch (error) {
      handleApiError(error, '更新失败');
    }
  };

  const actionItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <Edit className="h-4 w-4" />,
      label: '编辑',
      onClick: () => {
        editForm.setFieldsValue({
          title: feed.title,
          description: feed.description || '',
          siteUrl: feed.siteUrl || '',
          categoryId: feed.categoryId || '',
          fetchInterval: feed.fetchInterval,
          priority: feed.priority,
          isActive: feed.isActive,
        });
        setIsEditModalOpen(true);
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <Trash2 className="h-4 w-4" />,
      label: '删除',
      danger: true,
      onClick: handleDelete,
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isCollapsed ? 'hidden lg:hidden' : 'block'
        )}>
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 返回按钮 */}
            <Button
              type="text"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.back()}
              className="mb-4 hover:bg-muted/30"
            >
              返回
            </Button>

            {/* 订阅源头部 */}
            <Card className="mb-6 border-border/60">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* 图标 */}
                  {feed.iconUrl ? (
                    <img
                      src={feed.iconUrl}
                      alt=""
                      className="w-16 h-16 rounded-xl"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Rss className="h-8 w-8 text-primary" />
                    </div>
                  )}

                  {/* 信息 */}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-1">{feed.title}</h1>
                    {feed.description && (
                      <p className="text-muted-foreground mb-3">{feed.description}</p>
                    )}

                    {/* 元信息 */}
                    <Space size="middle" className="text-sm text-muted-foreground">
                      {feed.siteUrl && (
                        <a
                          href={feed.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          访问网站
                        </a>
                      )}
                      <span>·</span>
                      <span>
                        最后更新: {formatDistanceToNow(new Date(feed.lastFetchedAt || feed.createdAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                      <span>·</span>
                      <span>{feed.unreadCount} 篇未读</span>
                    </Space>
                  </div>
                </div>

                {/* 操作按钮 */}
                <Space>
                  <Button
                    icon={<RefreshCw className="h-4 w-4" />}
                    onClick={handleRefresh}
                    loading={refreshMutation.isPending}
                  >
                    刷新
                  </Button>
                  <Dropdown menu={{ items: actionItems }} trigger={['click']}>
                    <Button icon={<Settings className="h-4 w-4" />} />
                  </Dropdown>
                </Space>
              </div>

              {/* 统计信息 */}
              <Row gutter={16} className="mt-6 pt-6 border-t border-border/60">
                <Col xs={12} sm={6}>
                  <Statistic
                    title="文章总数"
                    value={feed._count.entries}
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="未读"
                    value={feed.unreadCount}
                    valueStyle={{ color: '#10B981', fontSize: '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="更新频率"
                    value={feed.fetchInterval / 60}
                    suffix="分钟"
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="优先级"
                    value={feed.priority}
                    valueStyle={{ fontSize: '1.5rem' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 文章列表 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">最新文章</h2>
              <EntryList feedId={feedId} />
            </div>
          </div>
        </main>
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑订阅源"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        width={500}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="订阅源标题" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={3} placeholder="订阅源描述" />
          </Form.Item>

          <Form.Item label="网站地址" name="siteUrl">
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item label="分类" name="categoryId">
            <Select
              placeholder="选择分类"
              allowClear
              options={categories?.map((cat) => ({
                label: cat.name,
                value: cat.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="更新频率（分钟）"
            name="fetchInterval"
            rules={[{ required: true }]}
          >
            <Select
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
          </Form.Item>

          <Form.Item label="优先级" name="priority">
            <Select
              options={[
                { label: '低', value: 1 },
                { label: '中', value: 5 },
                { label: '高', value: 10 },
              ]}
            />
          </Form.Item>

          <Form.Item name="isActive" valuePropName="checked">
            <div className="flex items-center justify-between py-2">
              <Space>
                <Info className="h-4 w-4 text-muted-foreground" />
                <span>启用此订阅源</span>
              </Space>
              <Switch />
            </div>
          </Form.Item>

          <Form.Item className="mb-0">
            <Space>
              <Button onClick={() => setIsEditModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存更改
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/**
 * 文章列表组件
 */
function EntryList({ feedId }: { feedId: string }) {
  const { data: entriesData, isLoading } = trpc.entries.list.useQuery({
    page: 1,
    limit: 20,
    feedId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const entries = entriesData?.items || [];

  if (entries.length === 0) {
    return <Empty description="该订阅源暂无文章" />;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`/entries/${entry.id}`}
          className="block p-4 bg-card border border-border/60 rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className={cn('font-medium mb-1', !entry.isRead && 'text-primary')}>
            {entry.title}
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2">
            {entry.summary}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {new Date(entry.publishedAt || '').toLocaleString('zh-CN')}
          </div>
        </a>
      ))}
    </div>
  );
}
