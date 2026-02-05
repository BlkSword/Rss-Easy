import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";
import { AntdRegistry } from "@/components/providers/antd-registry";
import { SidebarProvider } from "@/components/providers/sidebar-provider";

export const metadata: Metadata = {
  title: "Rss-Easy - 智能RSS资讯聚合平台",
  description: "支持AI智能摘要、智能分类、全文搜索、日报/周报生成的前沿RSS工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased bg-gradient-to-br from-background via-background to-muted/20 min-h-screen">
        {/* 全局背景装饰 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/3 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-primary/3 rounded-full blur-3xl" />
        </div>
        <AntdRegistry>
          <SidebarProvider>
            <TRPCProvider>{children}</TRPCProvider>
          </SidebarProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
