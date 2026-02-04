'use client';

/**
 * Feeds相关hooks
 */

import { trpc } from '@/lib/trpc/client';

export function useFeeds(filters?: {
  categoryId?: string;
  tag?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  return trpc.feeds.list.useQuery(filters || {});
}

export function useFeed(id: string) {
  return trpc.feeds.byId.useQuery({ id });
}

export function useAddFeed() {
  const utils = trpc.useUtils();
  return trpc.feeds.add.useMutation({
    onSuccess: () => {
      utils.feeds.list.invalidate();
    },
  });
}

export function useUpdateFeed() {
  const utils = trpc.useUtils();
  return trpc.feeds.update.useMutation({
    onSuccess: () => {
      utils.feeds.list.invalidate();
      utils.feeds.byId.invalidate();
    },
  });
}

export function useDeleteFeed() {
  const utils = trpc.useUtils();
  return trpc.feeds.delete.useMutation({
    onSuccess: () => {
      utils.feeds.list.invalidate();
    },
  });
}

export function useRefreshFeed() {
  return trpc.feeds.refresh.useMutation();
}

export function useFeedsBulkAction() {
  const utils = trpc.useUtils();
  return trpc.feeds.bulkAction.useMutation({
    onSuccess: () => {
      utils.feeds.list.invalidate();
    },
  });
}

export function useFeedStats(id: string) {
  return trpc.feeds.stats.useQuery({ id });
}
