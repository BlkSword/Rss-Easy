/**
 * tRPC客户端配置
 */

import { createTRPCReact } from '@trpc/react-query';
import { type AppRouter } from '@/server/api';

export const trpc = createTRPCReact<AppRouter>();

// 导出为 api，与现有组件保持一致
export { trpc as api };

