'use client';

import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Menu, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { MobileDrawer } from './mobile-drawer';
import { PullToRefresh } from './pull-to-refresh';

interface MobilePageWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backHref?: string;
  onBack?: () => void;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  headerActions?: ReactNode;
  headerContent?: ReactNode;
  className?: string;
  contentClassName?: string;
  onRefresh?: () => Promise<void>;
  pullToRefresh?: boolean;
  hideHeader?: boolean;
  fixedFooter?: ReactNode;
  safeArea?: boolean;
}

export function MobilePageWrapper({
  children,
  title,
  subtitle,
  showBackButton,
  backHref,
  onBack,
  showMenuButton,
  onMenuClick,
  headerActions,
  headerContent,
  className,
  contentClassName,
  onRefresh,
  pullToRefresh = false,
  hideHeader = false,
  fixedFooter,
  safeArea = true,
}: MobilePageWrapperProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // 桌面端简化渲染
  if (!isMobile) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      window.location.href = backHref;
    } else {
      window.history.back();
    }
  };

  const content = (
    <div
      className={cn(
        'min-h-full bg-background',
        safeArea && 'safe-area-top safe-area-bottom',
        className
      )}
    >
      {/* 头部导航 */}
      {!hideHeader && (
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-2 h-14 px-4">
            {/* 返回按钮 */}
            {(showBackButton || backHref) && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors touch-target"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* 菜单按钮 */}
            {showMenuButton && (
              <button
                onClick={onMenuClick}
                className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors touch-target"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* 标题区域 */}
            <div className="flex-1 min-w-0">
              {headerContent || (
                <>
                  {title && (
                    <h1 className="font-semibold text-lg truncate">{title}</h1>
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {subtitle}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* 操作按钮 */}
            {headerActions && (
              <div className="flex items-center gap-1">
                {headerActions}
              </div>
            )}
          </div>
        </header>
      )}

      {/* 主内容区 */}
      <main
        className={cn(
          'flex-1',
          fixedFooter ? 'pb-20' : 'pb-16',
          contentClassName
        )}
      >
        {children}
      </main>

      {/* 固定底部 */}
      {fixedFooter && (
        <div className="fixed bottom-0 left-0 right-0 z-40 safe-area-bottom bg-background/95 backdrop-blur-lg border-t border-border">
          {fixedFooter}
        </div>
      )}
    </div>
  );

  // 包装下拉刷新
  if (pullToRefresh && onRefresh) {
    return (
      <PullToRefresh onRefresh={onRefresh} className="h-full">
        {content}
      </PullToRefresh>
    );
  }

  return content;
}

// 移动端内容区块
interface MobileSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'normal' | 'large';
  divider?: boolean;
}

export function MobileSection({
  title,
  description,
  children,
  className,
  padding = 'normal',
  divider = false,
}: MobileSectionProps) {
  const paddingClass = {
    none: '',
    normal: 'px-4 py-4',
    large: 'px-4 py-6',
  }[padding];

  return (
    <section
      className={cn(
        divider && 'border-b border-border last:border-0',
        className
      )}
    >
      {(title || description) && (
        <div className={cn('px-4', padding !== 'none' && 'pt-4 pb-2')}>
          {title && (
            <h2 className="text-lg font-semibold">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={paddingClass}>{children}</div>
    </section>
  );
}

// 移动端卡片
interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  padding?: 'none' | 'normal' | 'large';
  shadow?: boolean;
}

export function MobileCard({
  children,
  className,
  onClick,
  href,
  padding = 'normal',
  shadow = false,
}: MobileCardProps) {
  const paddingClass = {
    none: '',
    normal: 'p-4',
    large: 'p-6',
  }[padding];

  const content = (
    <div
      className={cn(
        'bg-card rounded-xl border border-border overflow-hidden',
        paddingClass,
        shadow && 'shadow-sm',
        (onClick || href) && 'active:scale-[0.99] transition-transform cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }

  return content;
}

// 移动端空状态
interface MobileEmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function MobileEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: MobileEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {Icon && (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium touch-target"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// 移动端加载状态
interface MobileSkeletonProps {
  count?: number;
  className?: string;
}

export function MobileSkeleton({ count = 3, className }: MobileSkeletonProps) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-muted rounded-xl h-20 animate-pulse"
        />
      ))}
    </div>
  );
}

export default MobilePageWrapper;
