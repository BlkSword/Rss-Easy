/**
 * Ant Design 主题提供者 - 根据当前主题切换 Ant Design 组件颜色
 */

'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import { useTheme } from './theme-provider';
import { type ReactNode } from 'react';

interface AntdThemeProviderProps {
  children: ReactNode;
}

export function AntdThemeProvider({ children }: AntdThemeProviderProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const themeConfig = {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#3b82f6', // blue-500 - 更适合深蓝背景的强调色
      colorBgBase: isDark ? '#0f172a' : '#faf9f7', // slate-900
      colorTextBase: isDark ? '#e2e8f0' : '#292524', // slate-200
      colorBorder: isDark ? '#334155' : '#e7e5e4', // slate-700
      borderRadius: 8,
      wireframe: false,
    },
    components: {
      Card: {
        colorBgContainer: isDark ? '#1e293b' : '#ffffff', // slate-800
      },
      Modal: {
        colorBgElevated: isDark ? '#1e293b' : '#ffffff',
      },
      Drawer: {
        colorBgElevated: isDark ? '#1e293b' : '#ffffff',
      },
      Menu: {
        colorItemBg: isDark ? '#1e293b' : '#ffffff',
        colorItemBgSelected: isDark ? '#3b82f620' : '#eff6ff',
        colorItemTextSelected: '#3b82f6',
      },
      Input: {
        colorBgContainer: isDark ? '#1e293b' : '#ffffff',
      },
      Select: {
        colorBgContainer: isDark ? '#1e293b' : '#ffffff',
        optionSelectedBg: isDark ? '#3b82f620' : '#eff6ff',
      },
      Button: {
        primaryColor: '#ffffff',
      },
      Table: {
        colorBgContainer: isDark ? '#1e293b' : '#ffffff',
        headerBg: isDark ? '#334155' : '#fafaf9',
      },
      Tooltip: {
        colorBgElevated: isDark ? '#475569' : '#1e293b',
      },
      Popover: {
        colorBgElevated: isDark ? '#1e293b' : '#ffffff',
      },
      Tag: {
        defaultBg: isDark ? '#334155' : '#f5f5f4',
      },
      Badge: {
        colorBgContainer: isDark ? '#1e293b' : '#ffffff',
      },
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}
