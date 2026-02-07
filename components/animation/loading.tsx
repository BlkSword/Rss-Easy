/**
 * 加载动画组件
 */

import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'white';
}

export function Spinner({
  size = 'md',
  variant = 'default',
  className,
  ...props
}: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const variants = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    white: 'text-white',
  };

  return (
    <div
      className={cn('animate-spin', sizes[size], variants[variant], className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="w-full h-full"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

/**
 * 脉冲加载点
 */
interface DotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingDots({ size = 'md', className, ...props }: DotsProps) {
  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      {...props}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full bg-current animate-bounce',
            sizes[size]
          )}
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
}

/**
 * 骨架屏脉冲
 */
interface PulseProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Pulse({ children, className, ...props }: PulseProps) {
  return (
    <div
      className={cn('animate-pulse', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 全屏加载
 */
interface FullscreenLoaderProps {
  message?: string;
}

export function FullscreenLoader({ message = '加载中...' }: FullscreenLoaderProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" variant="primary" />
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      </div>
    </div>
  );
}

/**
 * 内容区域加载遮罩
 */
interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  children,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl z-10">
          <Spinner variant="primary" />
        </div>
      )}
    </div>
  );
}

export default Spinner;
