/**
 * Search API Router
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { getSearchService } from '@/lib/search/service';

export const searchRouter = router({
  /**
   * 简单搜索查询（用于搜索页面）
   */
  use: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const searchService = getSearchService();
      const suggestions = await searchService.getSuggestions(input.query, 5);
      return suggestions;
    }),

  /**
   * 全文搜索
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        semanticSearch: z.boolean().default(false),
        includeHighlights: z.boolean().default(true),
        filters: z
          .object({
            feedIds: z.array(z.string().uuid()).optional(),
            categoryIds: z.array(z.string().uuid()).optional(),
            tags: z.array(z.string()).optional(),
            isRead: z.boolean().optional(),
            isStarred: z.boolean().optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            minImportance: z.number().min(0).max(1).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const searchService = getSearchService();

      const { results, total } = await searchService.hybridSearch(input.query, {
        limit: input.limit,
        offset: input.offset,
        filters: input.filters,
        semanticSearch: input.semanticSearch,
        includeHighlights: input.includeHighlights,
      });

      // 保存搜索历史
      await searchService.saveSearchHistory(ctx.userId, input.query, total, input.filters);

      return {
        results,
        pagination: {
          total,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + input.limit < total,
        },
      };
    }),

  /**
   * 获取搜索建议
   */
  suggestions: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const searchService = getSearchService();
      const suggestions = await searchService.getSuggestions(input.query, input.limit);
      return suggestions;
    }),

  /**
   * 获取热门搜索
   */
  popular: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const searchService = getSearchService();
      const popular = await searchService.getPopularSearches(ctx.userId, input.limit);
      return popular;
    }),

  /**
   * 获取搜索历史
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const history = await ctx.db.searchHistory.findMany({
        where: {
          userId: ctx.userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
      });

      return history;
    }),

  /**
   * 清除搜索历史
   */
  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.searchHistory.deleteMany({
      where: {
        userId: ctx.userId,
      },
    });

    return { success: true };
  }),
});
