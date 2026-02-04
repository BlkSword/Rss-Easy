'use client';

/**
 * Categories相关hooks
 */

import { trpc } from '@/lib/trpc/client';

export function useCategories() {
  return trpc.categories.list.useQuery();
}

export function useAddCategory() {
  const utils = trpc.useUtils();
  return trpc.categories.add.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
    },
  });
}

export function useUpdateCategory() {
  const utils = trpc.useUtils();
  return trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
    },
  });
}

export function useDeleteCategory() {
  const utils = trpc.useUtils();
  return trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
    },
  });
}

export function useReorderCategories() {
  const utils = trpc.useUtils();
  return trpc.categories.reorder.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
    },
  });
}
