/**
 * localStorage hook
 * 支持状态持久化，并正确处理 SSR
 */

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // 使用 initialValue 作为初始状态，避免 SSR 不匹配
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // 在客户端挂载后，从 localStorage 读取实际值
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // 更新 localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // 删除值
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [initialValue, key]);

  // 监听其他窗口的更改
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        setStoredValue(JSON.parse(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue] as const;
}

/**
 * 用户偏好设置 hook
 */
export function useUserPreferences() {
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    'rss:sidebar-collapsed',
    false
  );
  const [compactMode, setCompactMode] = useLocalStorage(
    'rss:compact-mode',
    false
  );
  const [autoMarkRead, setAutoMarkRead] = useLocalStorage(
    'rss:auto-mark-read',
    true
  );
  const [fontSize, setFontSize] = useLocalStorage<'sm' | 'md' | 'lg'>(
    'rss:font-size',
    'md'
  );

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    compactMode,
    setCompactMode,
    autoMarkRead,
    setAutoMarkRead,
    fontSize,
    setFontSize,
  };
}

export default useLocalStorage;
