/**
 * 优化的图片组件
 * 使用 Next.js Image 组件，支持懒加载、占位符和错误处理
 */

'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  fallback?: React.ReactNode;
  onError?: () => void;
}

/** 默认的模糊占位符 (1x1 灰色像素) */
const defaultBlurDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** 加载失败时的默认回退组件 */
function DefaultFallback({ className }: { className?: string }) {
  return (
    <div className={cn(
      'bg-muted flex items-center justify-center',
      className
    )}>
      <svg
        className="w-1/2 h-1/2 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

/**
 * 优化的图片组件
 *
 * 特性：
 * - 自动懒加载（非优先图片）
 * - 加载中显示模糊占位符
 * - 加载失败显示回退组件
 * - 支持填充模式和固定尺寸模式
 *
 * @example
 * // 固定尺寸
 * <OptimizedImage src={feed.iconUrl} alt={feed.title} width={40} height={40} />
 *
 * // 填充容器
 * <div className="relative w-full h-64">
 *   <OptimizedImage src={url} alt="Cover" fill />
 * </div>
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  fill = false,
  priority = false,
  fallback,
  onError,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  }, [onError]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // 无图片或加载失败时显示回退
  if (!src || hasError) {
    return fallback ?? <DefaultFallback className={className} />;
  }

  // 填充模式
  if (fill) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          placeholder="blur"
          blurDataURL={defaultBlurDataURL}
          className={cn(
            'object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onError={handleError}
          onLoad={handleLoad}
          unoptimized // 对于外部图片，跳过 Next.js 图片优化
        />
      </div>
    );
  }

  // 固定尺寸模式
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        width={width ?? 100}
        height={height ?? 100}
        priority={priority}
        placeholder="blur"
        blurDataURL={defaultBlurDataURL}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized // 对于外部图片，跳过 Next.js 图片优化
      />
    </div>
  );
}

/**
 * Favicon 组件 - 专门用于显示网站图标
 */
export function Favicon({
  src,
  alt,
  size = 16,
  className,
}: {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'bg-gradient-to-br from-primary/20 to-primary/10 rounded flex items-center justify-center flex-shrink-0',
          className
        )}
        style={{ width: size, height: size }}
      >
        <svg
          className="text-primary"
          style={{ width: size * 0.6, height: size * 0.6 }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded object-cover flex-shrink-0', className)}
      onError={() => setHasError(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * 头像组件 - 用于显示用户头像或默认头像
 */
export function Avatar({
  src,
  alt,
  size = 40,
  className,
}: {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'bg-primary/10 rounded-full flex items-center justify-center',
          className
        )}
        style={{ width: size, height: size }}
      >
        <svg
          className="text-primary"
          style={{ width: size * 0.5, height: size * 0.5 }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full object-cover', className)}
      onError={() => setHasError(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

export default OptimizedImage;
