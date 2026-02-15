'use client';

/**
 * tRPC Provider组件
 * 安全增强：支持 CSRF Token 和 API Key
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { useState, useEffect, createContext, useContext, useRef } from 'react';
import SuperJSON from 'superjson';
import { trpc } from './client';

// CSRF Token 上下文
interface CsrfContextType {
  token: string | null;
  setToken: (token: string | null) => void;
}

const CsrfContext = createContext<CsrfContextType>({
  token: null,
  setToken: () => {},
});

export function useCsrfContext() {
  return useContext(CsrfContext);
}

/**
 * 自定义 fetch 函数，处理认证错误
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, init);

  // 检查是否是 401 错误
  if (response.status === 401) {
    // 清除本地存储的用户信息并跳转到登录页面
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
  }

  return response;
};

export function TRPCProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // CSRF Token 状态
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const csrfTokenRef = useRef<string | null>(null);

  // 保持 ref 同步
  useEffect(() => {
    csrfTokenRef.current = csrfToken;
  }, [csrfToken]);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30, // 30秒
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // 如果是 UNAUTHORIZED 错误，不重试
          if (error && (error as any).code === 'UNAUTHORIZED') {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        httpBatchLink({
          transformer: SuperJSON,
          url: getBaseUrl() + '/api/trpc',
          fetch: customFetch,
          headers() {
            const headers: Record<string, string> = {
              // 在这里添加认证头
              'x-user-id': typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : '',
            };

            // 添加 CSRF Token（用于 mutation 操作）
            const token = csrfTokenRef.current;
            if (token) {
              headers['x-csrf-token'] = token;
            }

            return headers;
          },
        }),
      ],
    })
  );

  return (
    <CsrfContext.Provider value={{ token: csrfToken, setToken: setCsrfToken }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </CsrfContext.Provider>
  );
}

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
