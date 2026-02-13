'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface SwipeConfig {
  threshold?: number;
  velocityThreshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  preventDefault?: boolean;
}

interface SwipeState {
  isSwiping: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  deltaX: number;
  deltaY: number;
}

export function useSwipe<T extends HTMLElement = HTMLDivElement>(
  config: SwipeConfig = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeStart,
    onSwipeEnd,
    preventDefault = true,
  } = config;

  const elementRef = useRef<T>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    deltaX: 0,
    deltaY: 0,
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTime.current = Date.now();
      setSwipeState({ isSwiping: true, direction: null, deltaX: 0, deltaY: 0 });
      onSwipeStart?.();
    },
    [onSwipeStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!swipeState.isSwiping) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      // 判断滑动方向
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      let direction: SwipeState['direction'] = null;

      if (absX > absY) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      setSwipeState({ isSwiping: true, direction, deltaX, deltaY });

      if (preventDefault && elementRef.current) {
        const shouldPrevent =
          (direction === 'left' || direction === 'right') && absX > 10;
        if (shouldPrevent) {
          e.preventDefault();
        }
      }
    },
    [swipeState.isSwiping, preventDefault]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!swipeState.isSwiping) return;

      const endTime = Date.now();
      const duration = endTime - startTime.current;
      const velocityX = Math.abs(swipeState.deltaX) / duration;
      const velocityY = Math.abs(swipeState.deltaY) / duration;

      const isFastSwipe = velocityX > velocityThreshold || velocityY > velocityThreshold;
      const isLongSwipe =
        Math.abs(swipeState.deltaX) > threshold ||
        Math.abs(swipeState.deltaY) > threshold;

      if (isFastSwipe || isLongSwipe) {
        switch (swipeState.direction) {
          case 'left':
            onSwipeLeft?.();
            break;
          case 'right':
            onSwipeRight?.();
            break;
          case 'up':
            onSwipeUp?.();
            break;
          case 'down':
            onSwipeDown?.();
            break;
        }
      }

      setSwipeState({
        isSwiping: false,
        direction: null,
        deltaX: 0,
        deltaY: 0,
      });
      onSwipeEnd?.();
    },
    [
      swipeState,
      threshold,
      velocityThreshold,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onSwipeEnd,
    ]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref: elementRef, swipeState };
}

// 滑动删除 Hook
interface SwipeToDeleteConfig {
  threshold?: number;
  onDelete?: () => void;
  onArchive?: () => void;
  onRead?: () => void;
}

export function useSwipeToDelete<T extends HTMLElement = HTMLDivElement>(
  config: SwipeToDeleteConfig = {}
) {
  const { threshold = 80, onDelete, onArchive, onRead } = config;
  const elementRef = useRef<T>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;

      currentX.current = e.touches[0].clientX;
      const deltaX = currentX.current - startX.current;

      // 只允许向右滑动（显示操作按钮）或向左滑动（删除）
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }

      setTranslateX(Math.max(-threshold * 1.5, Math.min(threshold * 1.5, deltaX)));
    },
    [isDragging, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const deltaX = currentX.current - startX.current;

    if (deltaX < -threshold) {
      // 向左滑动足够距离 - 删除
      setTranslateX(-threshold);
      onDelete?.();
    } else if (deltaX > threshold) {
      // 向右滑动足够距离 - 标记已读或归档
      setTranslateX(threshold);
      if (deltaX > threshold * 1.2) {
        onRead?.();
      } else {
        onArchive?.();
      }
    } else {
      // 回弹
      setTranslateX(0);
    }
  }, [threshold, onDelete, onArchive, onRead]);

  const reset = useCallback(() => {
    setTranslateX(0);
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref: elementRef,
    translateX,
    isDragging,
    reset,
  };
}

// 下拉刷新 Hook
interface PullToRefreshConfig {
  threshold?: number;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export function usePullToRefresh<T extends HTMLElement = HTMLDivElement>(
  config: PullToRefreshConfig
) {
  const { threshold = 80, onRefresh, disabled = false } = config;
  const containerRef = useRef<T>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      startScrollTop.current = container.scrollTop;
      if (startScrollTop.current === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || disabled || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      // 只有在顶部且向下拉时才触发
      if (deltaY > 0 && startScrollTop.current === 0) {
        e.preventDefault();
        // 使用阻尼效果
        const dampedDistance = Math.min(deltaY * 0.5, threshold * 1.5);
        setPullDistance(dampedDistance);
      }
    },
    [isPulling, disabled, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return {
    containerRef,
    pullDistance,
    isPulling,
    isRefreshing,
    progress,
  };
}

export default useSwipe;
