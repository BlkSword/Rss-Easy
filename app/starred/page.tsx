/**
 * 星标文章页面
 */

import { EntryList } from '@/components/entries/entry-list';

export const metadata = {
  title: '星标文章 - Rss-Easy',
  description: '查看星标的文章',
};

export default function StarredPage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">星标文章</h1>
        <p className="text-muted-foreground">收藏的重要文章</p>
      </div>
      <EntryList filters={{ starredOnly: true }} />
    </div>
  );
}
