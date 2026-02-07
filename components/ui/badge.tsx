/**
 * 徽章组件
 * 用于展示状态、计数、标签等
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { className, variant = 'default', size = 'sm', dot = false, children, ...props },
    ref
  ) => {
    const variants = {
      default: 'bg-muted text-muted-foreground',
      primary: 'bg-primary/15 text-primary border-primary/20',
      secondary: 'bg-secondary text-secondary-foreground',
      success: 'bg-green-500/15 text-green-600 border-green-500/20',
      warning: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
      danger: 'bg-red-500/15 text-red-600 border-red-500/20',
      info: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
    };

    const sizes = {
      sm: 'text-xs px-2 py-0.5',
      md: 'text-sm px-2.5 py-0.5',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium border transition-colors',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              variant === 'default' && 'bg-muted-foreground',
              variant === 'primary' && 'bg-primary',
              variant === 'success' && 'bg-green-500',
              variant === 'warning' && 'bg-yellow-500',
              variant === 'danger' && 'bg-red-500',
              variant === 'info' && 'bg-blue-500'
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
