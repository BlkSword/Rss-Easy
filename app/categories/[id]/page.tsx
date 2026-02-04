/**
 * 分类详情页面
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { EntryList } from '@/components/entries/entry-list';
import { trpc } from '@/lib/trpc/client';
import { ArrowLeft, FolderOpen, Rss } from 'lucide-react';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.id as string;

  const { data: category, isLoading } = trpc.categories.byId.useQuery({ id: categoryId });

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

  if (!category) {
    return (
      <div className="container py-6 text-center text-muted-foreground">
        分类不存在
      </div>
    );
  }

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

      {/* 分类头部 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: category.color ? `${category.color}20` : undefined }}
          >
            <FolderOpen
              className="h-5 w-5"
              style={{ color: category.color || undefined }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <p className="text-sm text-muted-foreground">
              {category._count.feeds} 个订阅源 · {category.unreadCount} 篇未读
            </p>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{category._count.feeds}</div>
          <div className="text-sm text-muted-foreground">订阅源</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{category.unreadCount}</div>
          <div className="text-sm text-muted-foreground">未读文章</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">
            {category._count.feeds > 0 ? Math.round(category.unreadCount / category._count.feeds) : 0}
          </div>
          <div className="text-sm text-muted-foreground">平均未读</div>
        </div>
      </div>

      {/* 订阅源列表 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Rss className="h-5 w-5" />
          该分类下的订阅源
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {category.feeds?.map((feed) => (
            <a
              key={feed.id}
              href={`/feeds/${feed.id}`}
              className="block bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {feed.iconUrl && (
                  <img src={feed.iconUrl} alt="" className="w-10 h-10 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{feed.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {feed.unreadCount} 篇未读
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 文章列表 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">最新文章</h2>
        <EntryList filters={{ categoryId }} />
      </div>
    </div>
  );
}
