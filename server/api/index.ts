/**
 * tRPC API Router
 * 整合所有API路由
 */

import { router } from '../trpc/init';
import { authRouter } from './auth';
import { feedsRouter } from './feeds';
import { entriesRouter } from './entries';
import { categoriesRouter } from './categories';
import { searchRouter } from './search';
import { reportsRouter } from './reports';

export const appRouter = router({
  auth: authRouter,
  feeds: feedsRouter,
  entries: entriesRouter,
  categories: categoriesRouter,
  search: searchRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
