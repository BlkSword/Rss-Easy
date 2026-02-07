/**
 * 统一卡片组件
 * 支持悬停效果、点击交互和多种变体，增强交互反馈
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  isHoverable?: boolean;
  isClickable?: boolean;
  isActive?: boolean;
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      isHoverable = false,
      isClickable = false,
      isActive = false,
      variant = 'default',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-2xl overflow-hidden transition-all duration-300 ease-out';

    const variants = {
      default: 'bg-card border border-border/60 shadow-sm',
      elevated: 'bg-card border border-border/40 shadow-lg shadow-primary/5',
      outlined: 'bg-transparent border-2 border-border/80',
      ghost: 'bg-transparent border-none',
    };

    const states = {
      hoverable: 'hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/20 card-warm',
      clickable: 'cursor-pointer hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-1 active:scale-[0.99] active:translate-y-0 card-warm',
      active: 'ring-2 ring-primary/30 border-primary/50 shadow-md shadow-primary/10',
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          isHoverable && states.hoverable,
          isClickable && states.clickable,
          isActive && states.active,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold leading-tight tracking-tight text-base', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0 gap-3', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export default Card;
