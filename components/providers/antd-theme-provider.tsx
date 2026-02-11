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
      colorPrimary: '#ea580c', // orange-600
      colorBgBase: isDark ? '#12100e' : '#faf9f7',
      colorTextBase: isDark ? '#f5f5f4' : '#292524',
      colorBorder: isDark ? '#44403c' : '#e7e5e4',
      borderRadius: 8,
      wireframe: false,
    },
    components: {
      Card: {
        colorBgContainer: isDark ? '#1c1917' : '#ffffff',
      },
      Modal: {
        colorBgElevated: isDark ? '#1c1917' : '#ffffff',
      },
      Drawer: {
        colorBgElevated: isDark ? '#1c1917' : '#ffffff',
      },
      Menu: {
        colorItemBg: isDark ? '#1c1917' : '#ffffff',
        colorItemBgSelected: isDark ? '#ea580c20' : '#fff7ed',
        colorItemTextSelected: '#ea580c',
      },
      Input: {
        colorBgContainer: isDark ? '#1c1917' : '#ffffff',
      },
      Select: {
        colorBgContainer: isDark ? '#1c1917' : '#ffffff',
        optionSelectedBg: isDark ? '#ea580c20' : '#fff7ed',
      },
      Button: {
        primaryColor: '#ffffff',
      },
      Table: {
        colorBgContainer: isDark ? '#1c1917' : '#ffffff',
        headerBg: isDark ? '#292524' : '#fafaf9',
      },
      Tooltip: {
        colorBgElevated: isDark ? '#44403c' : '#1c1917',
      },
      Popover: {
        colorBgElevated: isDark ? '#1c1917' : '#ffffff',
      },
      Tag: {
        defaultBg: isDark ? '#292524' : '#f5f5f4',
      },
      Badge: {
        colorBgContainer: isDark ? '#1c1917' : '#ffffff',
      },
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}
