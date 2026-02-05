/**
 * Ant Design Registry 组件
 * 用于在 Next.js 中使用 Ant Design - 书签风格
 */
'use client';

import { AntdRegistry as OriginalAntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import { antdTheme } from '@/lib/theme';

export function AntdRegistry({ children }: { children: React.ReactNode }) {
  return (
    <OriginalAntdRegistry>
      <ConfigProvider theme={antdTheme}>
        {children}
      </ConfigProvider>
    </OriginalAntdRegistry>
  );
}
