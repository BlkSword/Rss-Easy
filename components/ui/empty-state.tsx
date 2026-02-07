/**
 * 空状态组件 - 增强版
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

export function EmptyState({
  icon,
  title = '暂无数据',
  description = '这里还没有任何内容',
  action,
  secondaryAction,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const variants = {
    default: 'py-20 px-8',
    compact: 'py-12 px-6',
    card: 'py-16 px-8 bg-card border border-border/60 rounded-2xl',
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      variants[variant],
      className
    )}>
      {icon && (
        <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6 animate-float">
          <div className="text-muted-foreground/60">
            {icon}
          </div>
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      
      <div className="flex items-center gap-3">
        {action && (
          <Button onClick={action.onClick} variant="primary">
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button onClick={secondaryAction.onClick} variant="ghost">
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
