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
import { reportSchedulesRouter } from './report-schedules';
import { settingsRouter } from './settings';
import { rulesRouter } from './rules';
import { notificationsRouter } from './notifications';
import { aiRouter } from './ai';
import { analyticsRouter } from './analytics';
import { preliminaryRouter } from './preliminary';
import { logsRouter } from './logs';
import { queueRouter } from './queue';

export const appRouter = router({
  auth: authRouter,
  feeds: feedsRouter,
  entries: entriesRouter,
  categories: categoriesRouter,
  search: searchRouter,
  reports: reportsRouter,
  reportSchedules: reportSchedulesRouter,
  settings: settingsRouter,
  rules: rulesRouter,
  notifications: notificationsRouter,
  ai: aiRouter,
  analytics: analyticsRouter,
  preliminary: preliminaryRouter,
  logs: logsRouter,
  queue: queueRouter,
});

export type AppRouter = typeof appRouter;
