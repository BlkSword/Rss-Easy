/**
 * 统一按钮组件 - 基于 Tailwind CSS
 * 支持多种变体、尺寸和状态，增强交互反馈
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden btn-glow';

    const variants = {
      default:
        'bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/95 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
      primary:
        'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-xl hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
      secondary:
        'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow hover:-translate-y-0.5 active:translate-y-0',
      ghost:
        'hover:bg-muted/80 text-foreground hover:text-foreground active:bg-muted',
      danger:
        'bg-red-500 text-white shadow-md hover:bg-red-600 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
      outline:
        'border-2 border-border bg-transparent hover:bg-muted hover:border-primary/30 text-foreground hover:text-foreground active:bg-muted/80',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          'btn-ripple',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="transition-transform duration-200 group-hover:scale-110">{leftIcon}</span>}
        {!isLoading && <span className="relative z-10">{children}</span>}
        {!isLoading && rightIcon && <span className="transition-transform duration-200 group-hover:scale-110">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
