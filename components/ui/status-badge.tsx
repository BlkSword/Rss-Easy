/**
 * 状态徽章组件 - 带动画效果
 */

'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'default' | 'processing';
  children: React.ReactNode;
  className?: string;
  animated?: boolean;
  pulse?: boolean;
}

const statusStyles = {
  success: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    border: 'border-green-500/20',
    dot: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
  },
  default: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border/60',
    dot: 'bg-muted-foreground',
  },
  processing: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    dot: 'bg-primary',
  },
};

export function StatusBadge({
  status,
  children,
  className,
  animated = true,
  pulse = false,
}: StatusBadgeProps) {
  const styles = statusStyles[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        styles.bg,
        styles.text,
        styles.border,
        animated && 'transition-all duration-200',
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          styles.dot,
          (status === 'processing' || pulse) && 'animate-pulse'
        )}
      />
      {children}
    </span>
  );
}
