/**
 * 未读文章页面
 */

import { EntryList } from '@/components/entries/entry-list';

export const metadata = {
  title: '未读文章 - Rss-Easy',
  description: '查看未读的文章',
};

export default function UnreadPage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">未读文章</h1>
        <p className="text-muted-foreground">查看所有未阅读的文章</p>
      </div>
      <EntryList filters={{ unreadOnly: true }} />
    </div>
  );
}
