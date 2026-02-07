/**
 * 章节组件 - 带标题和动画的内容区块
 */

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useInViewAnimation } from '@/hooks/use-animation';

interface SectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  delay?: number;
  icon?: ReactNode;
  action?: ReactNode;
}

export function Section({
  children,
  title,
  description,
  className,
  delay = 0,
  icon,
  action,
}: SectionProps) {
  const { ref, isInView } = useInViewAnimation();

  return (
    <section
      ref={ref}
      className={cn(
        'mb-8',
        className
      )}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {(title || description || action) && (
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {icon}
              </div>
            )}
            <div>
              {title && <h2 className="text-lg font-semibold">{title}</h2>}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * 统计卡片组件
 */
interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  className,
  delay = 0,
}: StatCardProps) {
  const { ref, isInView } = useInViewAnimation();

  return (
    <div
      ref={ref}
      className={cn(
        'p-6 bg-card border border-border/60 rounded-2xl hover-lift',
        className
      )}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
          {trend && (
            <p className={cn(
              'text-sm mt-2 flex items-center gap-1',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
