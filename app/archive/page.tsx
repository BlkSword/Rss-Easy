/**
 * 归档文章页面
 */

import { EntryList } from '@/components/entries/entry-list';

export const metadata = {
  title: '归档文章 - Rss-Easy',
  description: '查看归档的文章',
};

export default function ArchivePage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">归档文章</h1>
        <p className="text-muted-foreground">已归档的历史文章</p>
      </div>
      <EntryList filters={{ archivedOnly: true }} />
    </div>
  );
}
