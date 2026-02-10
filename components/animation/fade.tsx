/**
 * 淡入淡出动画组件 - 增强版
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface FadeProps extends React.HTMLAttributes<HTMLDivElement> {
  in?: boolean;
  duration?: number;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  children: React.ReactNode;
  onEnter?: () => void;
  onExit?: () => void;
}

export function Fade({
  in: isVisible = true,
  duration = 300,
  delay = 0,
  direction = 'up',
  distance = 20,
  children,
  className,
  onEnter,
  onExit,
  ...props
}: FadeProps) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isVisible) {
      onEnter?.();
    } else {
      onExit?.();
    }
  }, [isVisible, onEnter, onExit]);

  const directions = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
    none: 'none',
  };

  if (!isMounted) return null;

  return (
    <div
      className={cn('transition-all h-full', className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : directions[direction],
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 交错动画容器
 */
interface StaggerContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  staggerDelay?: number;
  children: React.ReactNode;
  initialDelay?: number;
}

export function StaggerContainer({
  staggerDelay = 50,
  children,
  className,
  initialDelay = 0,
  ...props
}: StaggerContainerProps) {
  return (
    <div className={className} {...props}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        return (
          <Fade delay={initialDelay + index * staggerDelay} direction="up" distance={10}>
            {child}
          </Fade>
        );
      })}
    </div>
  );
}

/**
 * 缩放动画
 */
interface ScaleProps extends React.HTMLAttributes<HTMLDivElement> {
  in?: boolean;
  duration?: number;
  children: React.ReactNode;
  initialScale?: number;
}

export function Scale({
  in: isVisible = true,
  duration = 200,
  children,
  className,
  initialScale = 0.95,
  ...props
}: ScaleProps) {
  return (
    <div
      className={cn('transition-all', className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : `scale(${initialScale})`,
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 页面过渡动画
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Fade in direction="up" distance={15} duration={400} className={className}>
      {children}
    </Fade>
  );
}

/**
 * 列表项进入动画
 */
interface ListItemFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
  baseDelay?: number;
  children: React.ReactNode;
}

export function ListItemFade({
  index,
  baseDelay = 50,
  children,
  className,
  ...props
}: ListItemFadeProps) {
  return (
    <Fade
      delay={index * baseDelay}
      direction="up"
      distance={10}
      duration={300}
      className={className}
      {...props}
    >
      {children}
    </Fade>
  );
}

/**
 * 卡片悬停动画
 */
interface HoverLiftProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  lift?: number;
  shadow?: boolean;
}

export function HoverLift({
  children,
  className,
  lift = 4,
  shadow = true,
  ...props
}: HoverLiftProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={cn('transition-all duration-300', className)}
      style={{
        transform: isHovered ? `translateY(-${lift}px)` : 'translateY(0)',
        boxShadow: isHovered && shadow
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 通知进入动画
 */
interface NotificationSlideProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'top' | 'bottom';
}

export function NotificationSlide({
  children,
  className,
  direction = 'right',
  ...props
}: NotificationSlideProps) {
  const directions = {
    left: { x: -100, y: 0 },
    right: { x: 100, y: 0 },
    top: { x: 0, y: -100 },
    bottom: { x: 0, y: 100 },
  };

  const d = directions[direction];

  return (
    <Fade
      delay={0}
      direction="none"
      duration={300}
      className={className}
      {...props}
    >
      <div
        style={{
          animation: `notificationSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        <style jsx>{`
          @keyframes notificationSlide {
            from {
              transform: translate(${d.x}%, ${d.y}%);
              opacity: 0;
            }
            to {
              transform: translate(0, 0);
              opacity: 1;
            }
          }
        `}</style>
        {children}
      </div>
    </Fade>
  );
}
