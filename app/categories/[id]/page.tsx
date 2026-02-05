/**
 * 分类详情页面 - 全屏布局
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FolderOpen,
  Rss,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Button, Card, Row, Col, Statistic, Spin, Empty, Space, Modal, Form, Input, message, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.id as string;

  const { data: category, isLoading, refetch } = trpc.categories.byId.useQuery({ id: categoryId });
  const updateMutation = trpc.categories.update.useMutation();
  const deleteMutation = trpc.categories.delete.useMutation();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Spin size="large" />
          </main>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Empty description="分类不存在" />
          </main>
        </div>
      </div>
    );
  }

  const actionItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <Edit className="h-4 w-4" />,
      label: '编辑',
      onClick: () => {
        editForm.setFieldsValue({
          name: category.name,
          description: category.description || '',
          color: category.color || '#F97316',
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
      onClick: () => {
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除分类"${category.name}"吗？分类下的订阅源将变为未分类状态。`,
          okText: '删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: async () => {
            try {
              await deleteMutation.mutateAsync({ id: categoryId });
              handleApiSuccess('删除成功');
              router.push('/categories');
            } catch (error) {
              handleApiError(error, '删除失败');
            }
          },
        });
      },
    },
  ];

  const handleEditSubmit = async (values: any) => {
    try {
      await updateMutation.mutateAsync({
        id: categoryId,
        ...values,
      });
      handleApiSuccess('更新成功');
      setIsEditModalOpen(false);
      refetch();
    } catch (error) {
      handleApiError(error, '更新失败');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
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

            {/* 分类头部 */}
            <Card className="mb-6 border-border/60">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* 图标 */}
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    <FolderOpen
                      className="h-8 w-8"
                      style={{ color: category.color }}
                    />
                  </div>

                  {/* 信息 */}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-1">{category.name}</h1>
                    {category.description && (
                      <p className="text-muted-foreground mb-3">{category.description}</p>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {category.unreadCount} 篇未读 · {category._count.feeds} 个订阅源
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <Dropdown menu={{ items: actionItems }} trigger={['click']}>
                  <Button icon={<Edit className="h-4 w-4" />}>
                    编辑
                  </Button>
                </Dropdown>
              </div>

              {/* 统计信息 */}
              <Row gutter={16} className="mt-6 pt-6 border-t border-border/60">
                <Col xs={12} sm={6}>
                  <Statistic
                    title="订阅源"
                    value={category._count.feeds}
                    valueStyle={{ fontSize: '1.5rem' }}
                    prefix={<Rss className="h-4 w-4 text-muted-foreground" />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="未读文章"
                    value={category.unreadCount}
                    valueStyle={{ color: '#10B981', fontSize: '1.5rem' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 订阅源列表 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">订阅源</h2>
                <Button
                  type="primary"
                  size="small"
                  icon={<Plus className="h-4 w-4" />}
                  href={`/feeds/manage?feed=add&categoryId=${categoryId}`}
                >
                  添加订阅源
                </Button>
              </div>
              <FeedsList categoryId={categoryId} />
            </div>
          </div>
        </main>
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑分类"
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
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="分类名称" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="分类描述" />
          </Form.Item>

          <Form.Item
            label="颜色"
            name="color"
            rules={[{ required: true, message: '请选择颜色' }]}
          >
            <Input type="color" className="h-10" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space>
              <Button onClick={() => setIsEditModalOpen(false)}>取消</Button>
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
 * 订阅源列表组件
 */
function FeedsList({ categoryId }: { categoryId: string }) {
  const { data: feedsData, isLoading } = trpc.feeds.list.useQuery({
    categoryId,
    limit: 100,
  });

  const { data: updateMutations } = trpc.feeds.bulkAction.useMutation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const feeds = feedsData?.items || [];

  if (feeds.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="该分类下暂无订阅源"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {feeds.map((feed) => (
        <Link
          key={feed.id}
          href={`/feeds/${feed.id}`}
          className="block"
        >
          <Card
            className="border-border/60 hover:border-primary/50 transition-colors h-full"
            size="small"
          >
            <div className="flex items-start gap-3">
              {feed.iconUrl ? (
                <img src={feed.iconUrl} alt="" className="w-10 h-10 rounded-lg" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Rss className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{feed.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{feed.feedUrl}</p>
                <div className="flex items-center gap-2 mt-2">
                  {feed.unreadCount > 0 && (
                    <span className="text-xs text-primary">{feed.unreadCount} 篇未读</span>
                  )}
                  {!feed.isActive && (
                    <span className="text-xs text-muted-foreground">已禁用</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
