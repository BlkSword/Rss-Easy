/**
 * 订阅源详情页面
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
  MoreHorizontal,
} from 'lucide-react';
import { EntryList } from '@/components/entries/entry-list';
import { trpc } from '@/lib/trpc/client';

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const feedId = params.id as string;

  const { data: feed, isLoading, refetch } = trpc.feeds.byId.useQuery({ id: feedId });
  const updateMutation = trpc.feeds.update.useMutation();
  const deleteMutation = trpc.feeds.delete.useMutation();
  const refreshMutation = trpc.feeds.refresh.useMutation();

  const [showSettings, setShowSettings] = useState(false);

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4" />
          <div className="h-4 bg-muted rounded w-1/4 mb-6" />
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      </div>
  );
  }

  if (!feed) {
    return (
      <div className="container py-6 text-center text-muted-foreground">
        订阅源不存在
      </div>
    );
  }

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync({ id: feedId });
      refetch();
    } catch (error) {
      console.error('刷新失败:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要删除订阅源"${feed.title}"吗？此操作不可恢复。`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id: feedId });
      router.push('/');
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  return (
    <div className="container py-6">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      {/* 订阅源头部 */}
      <div className="bg-card border rounded-lg p-6 mb-6">
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
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
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
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <a
                  href={feed.siteUrl || feed.feedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  访问网站
                </a>
                <span>·</span>
                <span>
                  最后更新: {formatDistanceToNow(new Date(feed.lastFetchedAt || feed.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
                <span>·</span>
                <span>{feed.unreadCount} 篇未读</span>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="刷新订阅源"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              title="设置"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="p-2 hover:bg-red-500/10 hover:text-red-600 rounded-md transition-colors"
              title="删除订阅源"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{feed._count.entries}</div>
            <div className="text-sm text-muted-foreground">文章总数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{feed.unreadCount}</div>
            <div className="text-sm text-muted-foreground">未读</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{feed.fetchInterval / 60}分钟</div>
            <div className="text-sm text-muted-foreground">更新频率</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{feed.priority}</div>
            <div className="text-sm text-muted-foreground">优先级</div>
          </div>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="mt-6 pt-6 border-t space-y-4">
            <h3 className="font-semibold">订阅源设置</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">更新频率（分钟）</label>
                <select
                  defaultValue={feed.fetchInterval / 60}
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                >
                  <option value="15">15 分钟</option>
                  <option value="30">30 分钟</option>
                  <option value="60">1 小时</option>
                  <option value="120">2 小时</option>
                  <option value="360">6 小时</option>
                  <option value="720">12 小时</option>
                  <option value="1440">24 小时</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">优先级</label>
                <select
                  defaultValue={feed.priority}
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                >
                  <option value="1">低</option>
                  <option value="5">中</option>
                  <option value="10">高</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                defaultChecked={feed.isActive}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="active" className="text-sm">启用此订阅源</label>
            </div>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              保存设置
            </button>
          </div>
        )}
      </div>

      {/* 文章列表 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">最新文章</h2>
        <EntryList filters={{ feedId }} />
      </div>
    </div>
  );
}
