/**
 * 懒加载组件统一管理
 * 使用 Next.js dynamic import 实现代码分割
 * 减少首屏加载时间，提升页面切换速度
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ========== 加载状态组件 ==========

/** 通用骨架屏 */
function GenericSkeleton({ className = 'h-96 w-full' }: { className?: string }) {
  return <Skeleton className={className} />;
}

/** 侧边栏骨架屏 */
function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** 文章列表骨架屏 */
function EntryListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** AI 面板骨架屏 */
function AIPanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

/** 预览面板骨架屏 */
function PreviewPanelSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex-1 p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

// ========== 懒加载组件 ==========

/**
 * 文章列表组件（大型组件 ~829行）
 * 用于：首页、未读、已归档、星标等页面
 */
export const LazyEntryList = dynamic(
  () => import('@/components/entries/entry-list').then((mod) => mod.EntryList),
  {
    loading: EntryListSkeleton,
    ssr: false, // 客户端渲染，减少服务端压力
  }
);

/**
 * 侧边栏组件（大型组件 ~502行）
 * 用于：主布局
 */
export const LazyAppSidebar = dynamic(
  () => import('@/components/layout/app-sidebar').then((mod) => mod.AppSidebar),
  {
    loading: SidebarSkeleton,
  }
);

/**
 * 头部组件（大型组件 ~496行）
 * 用于：主布局
 */
export const LazyAppHeader = dynamic(
  () => import('@/components/layout/app-header').then((mod) => mod.AppHeader),
  {
    loading: () => <Skeleton className="h-16 w-full" />,
  }
);

/**
 * 紧凑型文章列表组件（用于三栏布局）
 * 注意：这个组件直接使用静态导入，因为它需要导出多个子组件
 * 如需懒加载，请在页面级别使用 Suspense 包裹
 */

/**
 * 文章预览面板（包含富文本渲染器）
 * 用于：三栏布局右侧
 */
export const LazyArticlePreviewPanel = dynamic(
  () => import('@/components/entries/article-preview-panel').then((mod) => mod.ArticlePreviewPanel),
  {
    loading: PreviewPanelSkeleton,
    ssr: false,
  }
);

/**
 * AI 分析面板
 * 用于：文章详情页
 */
export const LazyAIAnalysisPanel = dynamic(
  () => import('@/components/entries/ai-analysis-panel').then((mod) => mod.AIAnalysisPanel),
  {
    loading: AIPanelSkeleton,
    ssr: false,
  }
);

/**
 * 高级 AI 面板
 * 用于：深度分析功能
 */
export const LazyAdvancedAIPanel = dynamic(
  () => import('@/components/entries/advanced-ai-panel').then((mod) => mod.AdvancedAIPanel),
  {
    loading: AIPanelSkeleton,
    ssr: false,
  }
);

/**
 * 富文本渲染器（包含 highlight.js 等大型依赖）
 * 用于：文章内容渲染
 */
export const LazyRichContentRenderer = dynamic(
  () => import('@/components/entries/rich-content-renderer').then((mod) => mod.RichContentRenderer),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  }
);

/**
 * AI 分析侧边栏
 * 用于：文章详情页
 */
export const LazyAIAnalysisSidebar = dynamic(
  () => import('@/components/entries/ai-analysis-sidebar').then((mod) => mod.AIAnalysisSidebar),
  {
    loading: AIPanelSkeleton,
    ssr: false,
  }
);

// ========== 动画组件（懒加载以减少包体积） ==========

/**
 * 彩带动画（仅在需要时加载）
 */
export const LazyConfetti = dynamic(
  () => import('@/components/animation/confetti').then((mod) => mod.Confetti),
  {
    loading: () => null,
    ssr: false,
  }
);

/**
 * 液态按钮
 */
export const LazyLiquidButton = dynamic(
  () => import('@/components/animation/liquid-button').then((mod) => mod.LiquidButton),
  {
    loading: () => <Skeleton className="h-10 w-24" />,
    ssr: false,
  }
);

/**
 * 变形动画
 */
export const LazyMorphingShape = dynamic(
  () => import('@/components/animation/morphing-shape').then((mod) => mod.MorphingShape),
  {
    loading: () => null,
    ssr: false,
  }
);

// ========== 移动端组件 ==========

/**
 * 移动端底部导航
 */
export const LazyMobileBottomNav = dynamic(
  () => import('@/components/mobile/mobile-bottom-nav').then((mod) => mod.MobileBottomNav),
  {
    loading: () => <Skeleton className="h-16 w-full" />,
  }
);

/**
 * 移动端抽屉
 */
export const LazyMobileDrawer = dynamic(
  () => import('@/components/mobile/mobile-drawer').then((mod) => mod.MobileDrawer),
  {
    loading: () => null,
    ssr: false,
  }
);

/**
 * 移动端 FAB
 */
export const LazyMobileFAB = dynamic(
  () => import('@/components/mobile/mobile-fab').then((mod) => mod.MobileFab),
  {
    loading: () => null,
    ssr: false,
  }
);

// ========== 工具函数 ==========

/**
 * 创建自定义懒加载组件
 */
export function createLazyComponent<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  LoadingComponent?: () => React.ReactNode,
  options: { ssr?: boolean } = {}
) {
  return dynamic(importFn, {
    loading: LoadingComponent ?? (() => <GenericSkeleton />),
    ssr: options.ssr ?? false,
  });
}
