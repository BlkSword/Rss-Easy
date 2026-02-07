/**
 * 订阅源列表页面
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rss,
  Plus,
  Settings,
  MoreHorizontal,
  ExternalLink,
  Clock,
  FileText,
} from 'lucide-react';
import { Button, Card, Space, Typography, Dropdown, Tag, Progress, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { Fade } from '@/components/animation/fade';
import { usePageLoadAnimation } from '@/hooks/use-animation';
import { EmptyState } from '@/components/ui/empty-state';

const { Title, Text } = Typography;

export default function FeedsPage() {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isPageLoaded = usePageLoadAnimation(100);

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const { data: feedsData, isLoading } = trpc.feeds.list.useQuery(
    { limit: 100 },
    {
      refetchOnWindowFocus: false,
    }
  );

  const feeds = feedsData?.items || [];

  const groupedFeeds = feeds.reduce((acc, feed) => {
    const category = feed.category?.name || '未分类';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feed);
    return acc;
  }, {} as Record<string, typeof feeds>);

  const handleFeedClick = (feedId: string) => {
    router.push(`/feeds/${feedId}`);
  };

  const getFeedMenuItems = (feed: any): MenuProps['items'] => [
    {
      key: 'view',
      label: '查看文章',
      icon: <FileText className="h-4 w-4" />,
      onClick: () => router.push(`/feeds/${feed.id}`),
    },
    {
      key: 'settings',
      label: '订阅源设置',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => router.push(`/feeds/manage?id=${feed.id}`),
    },
    {
      type: 'divider',
    },
    {
      key: 'refresh',
      label: '立即刷新',
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader
        onToggleSidebar={toggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
          )}
        >
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* 头部 */}
            <Fade
              in={isPageLoaded}
              direction="down"
              distance={15}
              duration={500}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Rss className="h-6 w-6 text-primary" />
                    订阅源
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    共 {feeds.length} 个订阅源
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => router.push('/feeds/manage')}
                >
                  添加订阅
                </Button>
              </div>
            </Fade>

            {/* 订阅源列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Spin size="large" />
              </div>
            ) : feeds.length === 0 ? (
              <Fade in delay={150} direction="up" distance={20}>
                <EmptyState
                  icon={<Rss className="h-10 w-10" />}
                  title="还没有订阅源"
                  description="添加您的第一个RSS订阅源开始阅读"
                  variant="card"
                  action={{
                    label: '添加订阅源',
                    onClick: () => router.push('/feeds/manage'),
                  }}
                />
              </Fade>
            ) : (
              <Fade in delay={100} direction="up" distance={20}>
                <div className="space-y-6">
                  {Object.entries(groupedFeeds).map(([categoryName, categoryFeeds], categoryIndex) => (
                    <Fade
                      key={categoryName}
                      in
                      direction="up"
                      distance={15}
                      delay={100 + categoryIndex * 50}
                      duration={400}
                    >
                      <Card
                        className="border-border/60 hover:border-primary/30 transition-colors"
                        title={
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{categoryName}</span>
                            <Tag color="blue">{categoryFeeds.length}</Tag>
                          </div>
                        }
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryFeeds.map((feed, index) => (
                            <FeedCard
                              key={feed.id}
                              feed={feed}
                              onClick={() => handleFeedClick(feed.id)}
                              menuItems={getFeedMenuItems(feed)}
                              delay={index * 30}
                            />
                          ))}
                        </div>
                      </Card>
                    </Fade>
                  ))}
                </div>
              </Fade>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function FeedCard({
  feed,
  onClick,
  menuItems,
  delay,
}: {
  feed: any;
  onClick: () => void;
  menuItems: MenuProps['items'];
  delay: number;
}) {
  const unreadCount = feed.unreadCount || 0;
  const lastFetchedAt = feed.lastFetchedAt ? new Date(feed.lastFetchedAt) : null;

  return (
    <Fade in direction="up" distance={10} duration={300} delay={delay}>
      <div
        className="p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          {/* 图标 */}
          {feed.iconUrl ? (
            <img
              src={feed.iconUrl}
              alt={feed.title}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <Rss className="h-5 w-5 text-primary" />
            </div>
          )}

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                {feed.title}
              </h3>
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreHorizontal className="h-4 w-4" />}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0"
                />
              </Dropdown>
            </div>

            {feed.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {feed.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2">
              {unreadCount > 0 && (
                <Tag color="blue" className="text-xs">
                  {unreadCount} 未读
                </Tag>
              )}
              {lastFetchedAt && (
                <Text type="secondary" className="text-xs">
                  {formatRelativeTime(lastFetchedAt)}
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>
    </Fade>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}
