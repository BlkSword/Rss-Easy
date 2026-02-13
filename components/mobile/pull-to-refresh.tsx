'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pullThreshold?: number;
  maxPullDistance?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
  pullThreshold = 80,
  maxPullDistance = 120,
}: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const isTouching = useRef(false);

  const resetState = useCallback(() => {
    setIsPulling(false);
    setPullDistance(0);
    isTouching.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      startScrollTop.current = container.scrollTop;
      if (startScrollTop.current <= 0) {
        startY.current = e.touches[0].clientY;
        isTouching.current = true;
        setIsPulling(true);
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isTouching.current || disabled || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      // 只有在顶部且向下拉时才触发
      if (deltaY > 0 && startScrollTop.current <= 0) {
        // 防止默认滚动行为
        if (deltaY > 10) {
          e.preventDefault();
        }

        // 使用阻尼效果
        const resistance = 0.5;
        const dampedDistance = Math.min(deltaY * resistance, maxPullDistance);
        setPullDistance(dampedDistance);
      } else if (deltaY < 0) {
        // 向上滑动时取消拉动
        setIsPulling(false);
        setPullDistance(0);
        isTouching.current = false;
      }
    },
    [disabled, isRefreshing, maxPullDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isTouching.current) return;

    isTouching.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      // 触发刷新
      setIsRefreshing(true);
      setPullDistance(pullThreshold);

      try {
        await onRefresh();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1000);
      } finally {
        setIsRefreshing(false);
        resetState();
      }
    } else {
      // 回弹
      resetState();
    }
  }, [pullDistance, pullThreshold, isRefreshing, onRefresh, resetState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, isMobile]);

  // 非移动端直接返回内容
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  const progress = Math.min(pullDistance / pullThreshold, 1);
  const shouldTrigger = pullDistance >= pullThreshold;

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* 下拉指示器 */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        style={{
          height: pullDistance,
          opacity: Math.min(pullDistance / 40, 1),
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <AnimatePresence mode="wait">
            {isRefreshing ? (
              <motion.div
                key="refreshing"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <RefreshCw className="w-6 h-6 text-primary animate-spin" />
              </motion.div>
            ) : showSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="text-green-500"
              >
                <Check className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="pull"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  transform: `rotate(${progress * 180}deg)`,
                }}
              >
                <RefreshCw
                  className={cn(
                    'w-6 h-6 transition-colors',
                    shouldTrigger ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <span
            className={cn(
              'text-xs font-medium transition-colors',
              shouldTrigger ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {isRefreshing
              ? '刷新中...'
              : showSuccess
              ? '刷新成功'
              : shouldTrigger
              ? '释放刷新'
              : '下拉刷新'}
          </span>
        </div>
      </div>

      {/* 内容区域 */}
      <motion.div
        style={{
          y: isPulling || isRefreshing ? pullDistance : 0,
        }}
        transition={isPulling ? { type: 'tween', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-background min-h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

// 简化版刷新按钮（用于非触摸设备或作为备选）
interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  className?: string;
}

export function RefreshButton({ onRefresh, className }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isRefreshing}
      className={cn(
        'p-2 rounded-full hover:bg-muted transition-colors',
        isRefreshing && 'cursor-not-allowed',
        className
      )}
    >
      <RefreshCw
        className={cn('w-5 h-5', isRefreshing && 'animate-spin')}
      />
    </button>
  );
}

export default PullToRefresh;
