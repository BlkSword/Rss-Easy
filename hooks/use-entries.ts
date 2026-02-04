'use client';

/**
 * Entries相关hooks
 */

import { trpc } from '@/lib/trpc/client';

export function useEntries(filters?: {
  feedId?: string;
  categoryId?: string;
  tag?: string;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  archivedOnly?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  aiCategory?: string;
  minImportance?: number;
  page?: number;
  limit?: number;
}) {
  return trpc.entries.list.useQuery(filters || {});
}

export function useEntry(id: string) {
  return trpc.entries.byId.useQuery({ id });
}

export function useMarkAsRead() {
  const utils = trpc.useUtils();
  return trpc.entries.markAsRead.useMutation({
    onSuccess: () => {
      utils.entries.list.invalidate();
      utils.feeds.list.invalidate();
    },
  });
}

export function useMarkAsStarred() {
  const utils = trpc.useUtils();
  return trpc.entries.markAsStarred.useMutation({
    onSuccess: () => {
      utils.entries.list.invalidate();
    },
  });
}

export function useEntriesBulkAction() {
  const utils = trpc.useUtils();
  return trpc.entries.bulkAction.useMutation({
    onSuccess: () => {
      utils.entries.list.invalidate();
      utils.feeds.list.invalidate();
    },
  });
}

export function useAnalyzeEntry() {
  return trpc.entries.analyze.useMutation();
}
