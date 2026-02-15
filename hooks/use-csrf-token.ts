/**
 * CSRF Token 管理 Hook
 *
 * 自动获取和刷新 CSRF Token，用于保护 mutation 操作
 * 与 tRPC Provider 集成
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCsrfContext } from '@/lib/trpc/provider';

interface CsrfTokenState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
  expiresAt: Date | null;
}

interface CsrfTokenResponse {
  csrfToken: string;
  expiresAt: string;
}

/**
 * 获取 CSRF Token 的 Hook
 * 自动同步到 tRPC Provider
 */
export function useCsrfToken() {
  const { setToken } = useCsrfContext();
  const [state, setState] = useState<CsrfTokenState>({
    token: null,
    isLoading: true,
    error: null,
    expiresAt: null,
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取 CSRF Token
  const fetchToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/csrf');

      if (!response.ok) {
        if (response.status === 401) {
          // 未登录，不设置错误
          setState({
            token: null,
            isLoading: false,
            error: null,
            expiresAt: null,
          });
          setToken(null);
          return;
        }
        throw new Error('获取 CSRF Token 失败');
      }

      const data: CsrfTokenResponse = await response.json();

      const expiresAt = new Date(data.expiresAt);

      setState({
        token: data.csrfToken,
        isLoading: false,
        error: null,
        expiresAt,
      });

      // 同步到 tRPC Provider
      setToken(data.csrfToken);

      // 在 Token 过期前 5 分钟自动刷新
      const refreshTime = expiresAt.getTime() - Date.now() - 5 * 60 * 1000;
      if (refreshTime > 0) {
        refreshTimeoutRef.current = setTimeout(fetchToken, refreshTime);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '未知错误',
      }));
    }
  }, [setToken]);

  // 手动刷新 Token
  const refreshToken = useCallback(async () => {
    // 清除现有的刷新定时器
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    await fetchToken();
  }, [fetchToken]);

  // 初始化时获取 Token
  useEffect(() => {
    fetchToken();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchToken]);

  // 监听页面可见性变化，恢复时刷新 Token
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.expiresAt) {
        const now = Date.now();
        const expiresAtTime = state.expiresAt.getTime();

        // 如果 Token 已过期或即将过期（5分钟内），刷新
        if (expiresAtTime - now < 5 * 60 * 1000) {
          refreshToken();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.expiresAt, refreshToken]);

  return {
    csrfToken: state.token,
    isLoading: state.isLoading,
    error: state.error,
    expiresAt: state.expiresAt,
    refreshToken,
  };
}

export default useCsrfToken;
