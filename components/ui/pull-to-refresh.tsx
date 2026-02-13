'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  maxPull?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  
  // 使用 spring 动画使拉动更流畅
  const pullY = useSpring(0, { stiffness: 300, damping: 30 });
  const rotate = useTransform(pullY, [0, threshold], [0, 360]);
  const opacity = useTransform(pullY, [0, threshold * 0.5], [0, 1]);
  const scale = useTransform(pullY, [0, threshold], [0.8, 1]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    // 只有在顶部时才触发
    if (container.scrollTop > 5) return;
    
    startYRef.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 5) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    
    // 阻尼效果
    const dampedDiff = diff > 0 ? Math.min(diff * 0.5, maxPull) : 0;
    currentYRef.current = dampedDiff;
    pullY.set(dampedDiff);
  }, [isPulling, isRefreshing, maxPull, pullY]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    if (currentYRef.current >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      pullY.set(threshold * 0.8);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        pullY.set(0);
        currentYRef.current = 0;
      }
    } else {
      pullY.set(0);
      currentYRef.current = 0;
    }
    
    setIsPulling(false);
  }, [isPulling, isRefreshing, threshold, onRefresh, pullY]);

  // 防止在拉动时触发页面刷新
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventPullToRefresh = (e: TouchEvent) => {
      if (container.scrollTop === 0 && e.touches[0].clientY > startYRef.current) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    return () => container.removeEventListener('touchmove', preventPullToRefresh);
  }, []);

  const progress = Math.min(currentYRef.current / threshold, 1);

  return (
    <div className="relative overflow-hidden">
      {/* 下拉指示器 */}
      <motion.div
        style={{ y: pullY, opacity, scale }}
        className={cn(
          'absolute top-0 left-0 right-0 z-10',
          'flex items-center justify-center',
          'pointer-events-none'
        )}
      >
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-full',
          'bg-background/95 backdrop-blur-sm shadow-lg',
          'border border-border/60'
        )}>
          <motion.div
            style={{ rotate: isRefreshing ? undefined : rotate }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
          >
            <RefreshCw className={cn(
              'w-5 h-5',
              progress >= 1 || isRefreshing ? 'text-primary' : 'text-muted-foreground'
            )} />
          </motion.div>
          <span className={cn(
            'text-sm font-medium',
            progress >= 1 || isRefreshing ? 'text-primary' : 'text-muted-foreground'
          )}>
            {isRefreshing ? '刷新中...' : progress >= 1 ? '松开刷新' : '下拉刷新'}
          </span>
        </div>
      </motion.div>

      {/* 内容区域 */}
      <motion.div
        ref={containerRef}
        style={{ y: pullY }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'overflow-y-auto overscroll-y-contain',
          className
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default PullToRefresh;
