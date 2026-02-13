import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TRPCProvider } from '@/lib/trpc/provider';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AntdThemeProvider } from '@/components/providers/antd-theme-provider';
import { LanguageProvider } from '@/components/providers/language-provider';
import { PWAProvider } from '@/components/providers/pwa-provider';
import { MobileBottomNav } from '@/components/mobile/mobile-bottom-nav';
import { NetworkStatusToast, InstallPrompt, UpdatePrompt } from '@/components/mobile/mobile-toast';

export const metadata: Metadata = {
  title: 'Rss-Easy - 智能RSS资讯聚合平台',
  description: '支持AI智能摘要、智能分类、全文搜索、日报/周报生成的前沿RSS工具',
  keywords: ['RSS', 'AI', '阅读器', '资讯聚合', '智能摘要'],
  authors: [{ name: 'Rss-Easy Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1814' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('rss-easy-theme') || 'system';
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = theme === 'dark' || (theme === 'system' && systemDark);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        {/* 全局背景装饰 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-3xl" />
        </div>

        <ErrorBoundary>
          <PWAProvider>
            <LanguageProvider>
              <ThemeProvider>
                <AntdThemeProvider>
                  <ToastProvider>
                    <TRPCProvider>
                      {children}
                      {/* 移动端底部导航 */}
                      <MobileBottomNav />
                      {/* PWA 提示 */}
                      <NetworkStatusToast />
                      <InstallPrompt />
                      <UpdatePrompt />
                    </TRPCProvider>
                  </ToastProvider>
                </AntdThemeProvider>
              </ThemeProvider>
            </LanguageProvider>
          </PWAProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
