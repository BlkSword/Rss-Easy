/**
 * 计数器动画组件 - 带有图标和标签
 */

'use client';

import { ReactNode } from 'react';
import { AnimatedNumber } from './animated-number';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  label: string;
  icon?: ReactNode;
  duration?: number;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
};

export function AnimatedCounter({
  value,
  label,
  icon,
  duration = 1000,
  className,
  variant = 'default',
}: AnimatedCounterProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {icon && (
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
          'bg-muted'
        )}>
          {icon}
        </div>
      )}
      <div>
        <div className={cn(
          'text-2xl font-bold',
          variantStyles[variant]
        )}>
          <AnimatedNumber value={value} duration={duration} />
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
