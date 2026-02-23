/**
 * 订阅源详情页面 - 全屏布局（动画增强版）
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
  FileText,
  Clock,
  Zap,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { Button, Card as AntCard, Row, Col, Statistic, Empty, Dropdown, Modal, Input, Select, Switch, Space, Form, Badge, Tag } from 'antd';
const { TextArea } = Input;
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

// 动画组件
import { Fade, ListItemFade, Scale, HoverLift } from '@/components/animation/fade';
import { AnimatedCounter, AnimatedNumber } from '@/components/animation';
import { Spinner, Pulse } from '@/components/animation/loading';
import { usePageLoadAnimation, useRipple } from '@/hooks/use-animation';

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const feedId = params.id as string;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
  const isLoaded = usePageLoadAnimation(150);
  const createRipple = useRipple();

  const { data: feed, isLoading, refetch } = trpc.feeds.byId.useQuery({ id: feedId });
  const updateMutation = trpc.feeds.update.useMutation();
  const deleteMutation = trpc.feeds.delete.useMutation();
  const refreshMutation = trpc.feeds.refresh.useMutation();
  const { data: categories } = trpc.categories.list.useQuery();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();

  // 页面加载动画
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
          )}>
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" variant="primary" />
              <p className="text-sm text-muted-foreground animate-pulse">加载订阅源详情...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        <div className="flex-1 flex overflow-hidden">
          <aside className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
          )}>
            <AppSidebar />
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <Empty 
              description="订阅源不存在" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
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

  const openEditModal = () => {
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
  };

  const actionItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <Edit className="h-4 w-4" />,
      label: '编辑',
      onClick: openEditModal,
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
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
        )}>
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 返回按钮 */}
            <Fade in={isLoaded} delay={0} direction="left" distance={15}>
              <Button
                type="text"
                icon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => router.back()}
                className="mb-4 hover:bg-muted/30 transition-all duration-300 hover:translate-x-[-2px]"
              >
                返回
              </Button>
            </Fade>

            {/* 订阅源头部 - 带渐变背景 */}
            <Fade in={isLoaded} delay={100} direction="up" distance={20}>
              <AntCard 
                className="mb-6 border-border/60 overflow-hidden"
                bodyStyle={{ padding: 0 }}
              >
                {/* 渐变背景头部 */}
                <div className="relative">
                  {/* 渐变背景 */}
                  <div className="absolute inset-0 h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-background" />
                  <div className="absolute inset-0 h-32 bg-gradient-to-b from-transparent to-background/80" />
                  
                  {/* 内容区域 */}
                  <div className="relative px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {/* 图标 - 带悬停动画 */}
                        <HoverLift lift={6} shadow>
                          {feed.iconUrl ? (
                            <img
                              src={feed.iconUrl}
                              alt=""
                              className="w-16 h-16 rounded-xl shadow-lg border-2 border-background"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                              <Rss className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </HoverLift>

                        {/* 信息 */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold">{feed.title}</h1>
                            {!feed.isActive && (
                              <Tag color="default">已停用</Tag>
                            )}
                          </div>
                          {feed.description && (
                            <p className="text-muted-foreground mb-3 max-w-xl">{feed.description}</p>
                          )}

                          {/* 元信息 */}
                          <Space size="middle" className="text-sm text-muted-foreground">
                            {feed.siteUrl && (
                              <a
                                href={feed.siteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-primary transition-colors hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                访问网站
                              </a>
                            )}
                            <span className="text-border">·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              最后更新: {formatDistanceToNow(new Date(feed.lastFetchedAt || feed.createdAt), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                            {feed.unreadCount > 0 && (
                              <>
                                <span className="text-border">·</span>
                                <Badge 
                                  count={feed.unreadCount} 
                                  className="transform scale-90"
                                  style={{ backgroundColor: '#10B981' }}
                                />
                                <span>篇未读</span>
                              </>
                            )}
                          </Space>
                        </div>
                      </div>

                      {/* 操作按钮 - 带交互反馈 */}
                      <Space className="pt-2">
                        <Button
                          icon={
                            <RefreshCw className={cn(
                              "h-4 w-4 transition-transform duration-500",
                              refreshMutation.isPending && "animate-spin"
                            )} />
                          }
                          onClick={handleRefresh}
                          loading={refreshMutation.isPending}
                          className="hover:scale-105 active:scale-95 transition-transform"
                        >
                          刷新
                        </Button>
                        <Dropdown menu={{ items: actionItems }} trigger={['click']}>
                          <Button 
                            icon={<Settings className="h-4 w-4" />}
                            className="hover:scale-105 active:scale-95 transition-transform hover:rotate-45 duration-300"
                          />
                        </Dropdown>
                      </Space>
                    </div>
                  </div>
                </div>

                {/* 统计信息 - 带动画计数器 */}
                <div className="px-6 pb-6 pt-2 border-t border-border/60">
                  <Row gutter={[24, 16]}>
                    <Col xs={12} sm={6}>
                      <div className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors duration-300">
                        <AnimatedCounter
                          value={feed._count.entries}
                          label="文章总数"
                          icon={<FileText className="h-5 w-5 text-primary" />}
                          duration={1200}
                          variant="primary"
                        />
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <div className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors duration-300">
                        <AnimatedCounter
                          value={feed.unreadCount}
                          label="未读文章"
                          icon={<AlertCircle className="h-5 w-5 text-green-600" />}
                          duration={1000}
                          variant="success"
                        />
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <div className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors duration-300">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-muted">
                            <Clock className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">
                              <AnimatedNumber 
                                value={feed.fetchInterval / 60} 
                                duration={1000}
                                suffix=" 分钟"
                              />
                            </div>
                            <div className="text-sm text-muted-foreground">更新频率</div>
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <div className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors duration-300">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-muted">
                            <Zap className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-600">
                              <AnimatedNumber 
                                value={feed.priority} 
                                duration={800}
                              />
                            </div>
                            <div className="text-sm text-muted-foreground">优先级</div>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </AntCard>
            </Fade>

            {/* 文章列表 */}
            <Fade in={isLoaded} delay={200} direction="up" distance={15}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    最新文章
                  </h2>
                  {feed.unreadCount > 0 && (
                    <Tag color="success">{feed.unreadCount} 篇未读</Tag>
                  )}
                </div>
                <EntryList feedId={feedId} isLoaded={isLoaded} />
              </div>
            </Fade>
          </div>
        </main>
      </div>

      {/* 编辑弹窗 - 带动画 */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            编辑订阅源
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        width={500}
        footer={null}
        destroyOnClose
        transitionName="ant-zoom"
        maskTransitionName="ant-fade"
      >
        <Scale in={isEditModalOpen} duration={250} initialScale={0.95}>
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditSubmit}
            className="pt-2"
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
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                <Space>
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span>启用此订阅源</span>
                </Space>
                <Switch />
              </div>
            </Form.Item>

            <Form.Item className="mb-0 pt-2">
              <Space className="w-full justify-end">
                <Button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="hover:scale-105 active:scale-95 transition-transform"
                >
                  取消
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={updateMutation.isPending}
                  className="hover:scale-105 active:scale-95 transition-transform"
                >
                  保存更改
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Scale>
      </Modal>
    </div>
  );
}

/**
 * 文章列表组件（带动画）
 */
function EntryList({ feedId, isLoaded }: { feedId: string; isLoaded: boolean }) {
  const { data: entriesData, isLoading } = trpc.entries.list.useQuery({
    page: 1,
    limit: 20,
    feedId,
  });
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            className="p-4 bg-card border border-border/60 rounded-lg"
          >
            <Pulse>
              <div className="h-5 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-full mb-1" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </Pulse>
          </div>
        ))}
      </div>
    );
  }

  const entries = entriesData?.items || [];

  if (entries.length === 0) {
    return (
      <Fade in={isLoaded} delay={300}>
        <div className="py-16">
          <Empty
            image={
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/50" />
                </div>
              </div>
            }
            description={
              <div className="text-center">
                <p className="text-muted-foreground text-lg mb-1">该订阅源暂无文章</p>
                <p className="text-sm text-muted-foreground/60">稍后再来看看吧</p>
              </div>
            }
          />
        </div>
      </Fade>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <ListItemFade
          key={entry.id}
          index={index}
          baseDelay={50}
        >
          <HoverLift lift={3} shadow={false}>
            <div
              onClick={() => router.push(`/entries/${entry.id}`)}
              className={cn(
                "block p-4 bg-card border border-border/60 rounded-lg cursor-pointer",
                "hover:border-primary/50 hover:bg-muted/20",
                "transition-all duration-300 group"
              )}
            >
              <div className={cn(
                'font-medium mb-1 transition-colors duration-200',
                !entry.isRead ? 'text-primary' : 'text-foreground',
                'group-hover:text-primary'
              )}>
                {entry.title}
                {!entry.isRead && (
                  <span className="ml-2 inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2 group-hover:text-muted-foreground/80 transition-colors">
                {entry.summary}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                <Clock className="h-3 w-3" />
                {new Date(entry.publishedAt || '').toLocaleString('zh-CN')}
              </div>
            </div>
          </HoverLift>
        </ListItemFade>
      ))}
    </div>
  );
}
