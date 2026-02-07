/**
 * 页面容器组件 - 统一页面布局和动画
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/animation/fade';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  fullHeight?: boolean;
  withTransition?: boolean;
}

export function PageContainer({
  children,
  className,
  fullHeight = true,
  withTransition = true,
}: PageContainerProps) {
  const content = (
    <div className={cn(
      fullHeight && 'h-screen flex flex-col overflow-hidden',
      'bg-background',
      className
    )}>
      {children}
    </div>
  );

  if (withTransition) {
    return (
      <PageTransition>
        {content}
      </PageTransition>
    );
  }

  return content;
}

/**
 * 页面头部组件
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(
      'flex items-start justify-between mb-6',
      className
    )}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * 页面内容区域组件
 */
interface PageContentProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl' | 'full';
  withSidebar?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
  'full': 'max-w-none',
};

export function PageContent({
  children,
  className,
  maxWidth = '5xl',
  withSidebar = true,
}: PageContentProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-background/30">
      <div className={cn(
        'mx-auto px-6 py-8',
        maxWidthClasses[maxWidth],
        className
      )}>
        {children}
      </div>
    </main>
  );
}
