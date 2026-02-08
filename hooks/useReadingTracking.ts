'use client';

/**
 * 阅读行为追踪 Hook
 *
 * 自动追踪用户的阅读行为，包括：
 * - 停留时间
 * - 滚动深度
 * - 阅读完成状态
 * - 关注段落
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/trpc/react';

interface UseReadingTrackingOptions {
  entryId: string;
  enabled?: boolean;
  reportInterval?: number; // 上报间隔（毫秒）
  minDwellTime?: number; // 最小停留时间（秒）
  minScrollDepth?: number; // 最小滚动深度
}

export function useReadingTracking({
  entryId,
  enabled = true,
  reportInterval = 30000, // 默认30秒上报一次
  minDwellTime = 5,
  minScrollDepth = 0.1,
}: UseReadingTrackingOptions) {
  const [isActive, setIsActive] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);

  const startTimeRef = useRef<Date | null>(null);
  const maxScrollRef = useRef(0);
  const reportTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastReportTimeRef = useRef<number>(0);

  const { mutate: trackReading, isPending } = api.analytics.trackReading.useMutation();

  // 计算当前滚动深度
  const calculateScrollDepth = useCallback(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return 0;
    const scrolled = window.scrollY;
    return Math.min(1, Math.max(0, scrolled / scrollHeight));
  }, []);

  // 上报阅读进度
  const reportProgress = useCallback((isCompleted = false) => {
    if (!startTimeRef.current) return;

    const now = Date.now();
    const dwellTime = Math.floor((now - startTimeRef.current.getTime()) / 1000);

    // 过滤掉停留时间过短或滚动深度过浅的记录
    if (!isCompleted && dwellTime < minDwellTime) return;
    if (!isCompleted && maxScrollRef.current < minScrollDepth) return;

    // 避免频繁上报（距离上次上报不足间隔时间）
    if (!isCompleted && now - lastReportTimeRef.current < reportInterval) {
      return;
    }

    trackReading({
      entryId,
      dwellTime,
      scrollDepth: maxScrollRef.current,
      isCompleted,
    });

    lastReportTimeRef.current = now;
  }, [entryId, minDwellTime, minScrollDepth, reportInterval, trackReading]);

  // 最终上报（页面卸载时）
  const finalReport = useCallback(() => {
    const scrollDepth = maxScrollRef.current;
    const isCompleted = scrollDepth >= 0.9; // 滚动超过90%视为完成
    reportProgress(isCompleted);
  }, [reportProgress]);

  // 初始化阅读会话
  useEffect(() => {
    if (!enabled) return;

    const handleStart = () => {
      if (!isActive) {
        setIsActive(true);
        startTimeRef.current = new Date();
      }
    };

    // 监听用户交互
    const events = [
      ['scroll', handleStart] as const,
      ['keydown', handleStart] as const,
      ['click', handleStart] as const,
      ['mousemove', handleStart] as const,
    ];

    events.forEach(([event, handler]) => {
      document.addEventListener(event, handler, { once: true, passive: true });
    });

    return () => {
      events.forEach(([event, handler]) => {
        document.removeEventListener(event, handler);
      });
    };
  }, [enabled, isActive]);

  // 追踪滚动深度
  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      const depth = calculateScrollDepth();
      maxScrollRef.current = Math.max(maxScrollRef.current, depth);
      setScrollDepth(maxScrollRef.current);
    };

    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => document.removeEventListener('scroll', handleScroll);
  }, [enabled, calculateScrollDepth]);

  // 定期上报
  useEffect(() => {
    if (!enabled || !isActive) return;

    reportTimerRef.current = setInterval(() => {
      reportProgress(false);
    }, reportInterval);

    return () => {
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current);
      }
    };
  }, [enabled, isActive, reportInterval, reportProgress]);

  // 页面卸载时最终上报
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      finalReport();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        finalReport();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 组件卸载时也上报
      finalReport();
    };
  }, [enabled, finalReport]);

  // 手动标记为星标
  const markAsStarred = useCallback(() => {
    reportProgress(false);
    // 这里可以调用 toggleStar API
  }, [reportProgress]);

  // 手动评分
  const rateEntry = useCallback((rating: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = new Date();
    }

    trackReading({
      entryId,
      dwellTime: Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000),
      scrollDepth: maxScrollRef.current,
      isCompleted: false,
      rating,
    });
  }, [entryId, trackReading]);

  return {
    isActive,
    scrollDepth,
    isPending,
    markAsStarred,
    rateEntry,
  };
}
