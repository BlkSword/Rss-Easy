/**
 * 设置页面 - 独立页面（无侧栏）
 * 使用项目统一的设计系统
 */

'use client';

import { Suspense } from 'react';
import { SettingsPageContent } from './settings-page-content';

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}

// 加载骨架屏
function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex-shrink-0 h-14 border-b border-border/60 header-glass">
        <div className="flex h-full items-center px-4">
          <div className="animate-pulse bg-muted h-5 w-20 rounded" />
        </div>
      </header>
      <div className="flex-1 flex">
        <aside className="w-56 border-r border-border/60 bg-muted/10 p-4 hidden md:block">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-muted h-10 rounded-xl" />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-muted h-32 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
