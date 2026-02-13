/**
 * 触摸手势 Hook
 * 提供滑动删除、下拉刷新等手势支持
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface SwipeConfig {
  threshold?: number;
  velocityThreshold?: number;
  direction?: 'left' | 'right' | 'both';
}

interface SwipeState {
  isSwiping: boolean;
  startX: number;
  currentX: number;
  deltaX: number;
  progress: number;
}

/**
 * 滑动手势 Hook - 用于滑动删除
 */
export function useSwipeGesture(
  onSwipeComplete: (direction: 'left' | 'right') => void,
  config: SwipeConfig = {}
) {
  const {
    threshold = 100,
    velocityThreshold = 0.5,
    direction = 'both',
  } = config;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    startX: 0,
    currentX: 0,
    deltaX: 0,
    progress: 0,
  });

  const startTimeRef = useRef<number>(0);
  const elementRef = useRef<HTMLElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startTimeRef.current = Date.now();
    setSwipeState({
      isSwiping: true,
      startX: touch.clientX,
      currentX: touch.clientX,
      deltaX: 0,
      progress: 0,
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState.isSwiping) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;

    // 检查方向限制
    if (direction === 'left' && deltaX > 0) return;
    if (direction === 'right' && deltaX < 0) return;

    const progress = Math.min(Math.abs(deltaX) / threshold, 1);

    setSwipeState((prev) => ({
      ...prev,
      currentX: touch.clientX,
      deltaX,
      progress,
    }));
  }, [swipeState.isSwiping, swipeState.startX, threshold, direction]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isSwiping) return;

    const deltaTime = Date.now() - startTimeRef.current;
    const velocity = Math.abs(swipeState.deltaX) / deltaTime;
    const shouldTrigger =
      Math.abs(swipeState.deltaX) > threshold || velocity > velocityThreshold;

    if (shouldTrigger) {
      const swipeDirection = swipeState.deltaX > 0 ? 'right' : 'left';
      if (direction === 'both' || direction === swipeDirection) {
        onSwipeComplete(swipeDirection);
      }
    }

    setSwipeState({
      isSwiping: false,
      startX: 0,
      currentX: 0,
      deltaX: 0,
      progress: 0,
    });
  }, [swipeState, threshold, velocityThreshold, direction, onSwipeComplete]);

  return {
    swipeState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    elementRef,
  };
}

/**
 * 下拉刷新 Hook
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  config: { threshold?: number; maxPull?: number } = {}
) {
  const { threshold = 80, maxPull = 120 } = config;

  const [pullState, setPullState] = useState({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const startYRef = useRef<number>(0);
  const containerRef = useRef<HTMLElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // 只有在顶部时才触发下拉刷新
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    startYRef.current = e.touches[0].clientY;
    setPullState((prev) => ({ ...prev, isPulling: true }));
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullState.isPulling || pullState.isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const pullDistance = Math.min(
      Math.max(0, (currentY - startYRef.current) * 0.5),
      maxPull
    );

    setPullState((prev) => ({ ...prev, pullDistance }));
  }, [pullState.isPulling, pullState.isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullState.isPulling) return;

    if (pullState.pullDistance >= threshold && !pullState.isRefreshing) {
      setPullState((prev) => ({ ...prev, isRefreshing: true }));
      
      try {
        await onRefresh();
      } finally {
        setPullState({
          isPulling: false,
          pullDistance: 0,
          isRefreshing: false,
        });
      }
    } else {
      setPullState({
        isPulling: false,
        pullDistance: 0,
        isRefreshing: false,
      });
    }
  }, [pullState, threshold, onRefresh]);

  return {
    pullState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    containerRef,
    progress: Math.min(pullState.pullDistance / threshold, 1),
  };
}

/**
 * 双击缩放 Hook
 */
export function useDoubleTap(
  onDoubleTap: () => void,
  delay: number = 300
) {
  const [tapCount, setTapCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTap = useCallback(() => {
    setTapCount((prev) => prev + 1);

    if (tapCount === 1) {
      onDoubleTap();
      setTapCount(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    } else {
      timerRef.current = setTimeout(() => {
        setTapCount(0);
      }, delay);
    }
  }, [tapCount, delay, onDoubleTap]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return handleTap;
}

/**
 * 长按手势 Hook
 */
export function useLongPress(
  onLongPress: () => void,
  config: { delay?: number; shouldPreventDefault?: boolean } = {}
) {
  const { delay = 500, shouldPreventDefault = true } = config;

  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isTriggeredRef = useRef(false);

  const startPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (shouldPreventDefault && 'touches' in e) {
      // 防止默认行为
    }
    
    isTriggeredRef.current = false;
    setIsPressing(true);

    timerRef.current = setTimeout(() => {
      isTriggeredRef.current = true;
      onLongPress();
      setIsPressing(false);
    }, delay);
  }, [delay, onLongPress, shouldPreventDefault]);

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    isPressing,
    handlers: {
      onTouchStart: startPress,
      onTouchEnd: endPress,
      onTouchMove: endPress,
      onMouseDown: startPress,
      onMouseUp: endPress,
      onMouseLeave: endPress,
      onContextMenu: (e: React.MouseEvent) => {
        if (shouldPreventDefault) {
          e.preventDefault();
        }
      },
    },
    isTriggered: () => isTriggeredRef.current,
  };
}

/**
 * 横向滑动切换 Hook
 */
export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  config: { threshold?: number } = {}
) {
  const { threshold = 50 } = config;
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        setSwipeDirection('left');
        onSwipeLeft();
      } else {
        setSwipeDirection('right');
        onSwipeRight();
      }

      // 重置方向状态
      setTimeout(() => setSwipeDirection(null), 100);
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    swipeDirection,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
  };
}

export default useSwipeGesture;
