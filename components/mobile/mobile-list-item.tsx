'use client';

import { useState, useRef } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { Check, Star, Trash2, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

interface SwipeAction {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}

interface MobileListItemProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onMarkRead?: () => void;
  onStar?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  isRead?: boolean;
  isStarred?: boolean;
  className?: string;
  disabled?: boolean;
}

export function MobileListItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  onMarkRead,
  onStar,
  onDelete,
  onArchive,
  isRead,
  isStarred,
  className,
  disabled = false,
}: MobileListItemProps) {
  const isMobile = useIsMobile();
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // 根据滑动距离显示不同的操作
  const leftActionOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const rightActionOpacity = useTransform(x, [0, 50, 100], [0, 0.5, 1]);
  const leftActionScale = useTransform(x, [-100, -50, 0], [1, 0.8, 0.5]);
  const rightActionScale = useTransform(x, [0, 50, 100], [0.5, 0.8, 1]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const threshold = 80;

    if (info.offset.x < -threshold) {
      // 向左滑动
      if (onSwipeLeft) {
        onSwipeLeft();
      } else if (onMarkRead) {
        onMarkRead();
      }
    } else if (info.offset.x > threshold) {
      // 向右滑动
      if (onSwipeRight) {
        onSwipeRight();
      } else if (onArchive) {
        onArchive();
      }
    }

    // 回弹动画
    x.set(0);
  };

  if (!isMobile || disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={constraintsRef} className="relative overflow-hidden">
      {/* 左侧滑动操作背景 */}
      <motion.div
        style={{ opacity: leftActionOpacity, scale: leftActionScale }}
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 gap-2"
      >
        <div className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center',
          isRead ? 'bg-green-500' : 'bg-blue-500'
        )}>
          <Check className="w-6 h-6 text-white" />
        </div>
        {onDelete && (
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
        )}
      </motion.div>

      {/* 右侧滑动操作背景 */}
      <motion.div
        style={{ opacity: rightActionOpacity, scale: rightActionScale }}
        className="absolute inset-y-0 left-0 flex items-center pl-4 gap-2"
      >
        {onStar && (
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center',
            isStarred ? 'bg-yellow-500' : 'bg-gray-500'
          )}>
            <Star className={cn('w-6 h-6 text-white', isStarred && 'fill-current')} />
          </div>
        )}
        {onArchive && (
          <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center">
            <Archive className="w-6 h-6 text-white" />
          </div>
        )}
      </motion.div>

      {/* 可滑动内容 */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          'relative bg-background touch-pan-y',
          isDragging && 'cursor-grabbing',
          className
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}

// 可折叠列表项（用于分类、文件夹等）
interface CollapsibleListItemProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  badge?: number;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CollapsibleListItem({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  defaultExpanded = false,
  onClick,
  className,
}: CollapsibleListItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isMobile = useIsMobile();

  const handleClick = () => {
    if (children) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  return (
    <div className={cn('border-b border-border last:border-0', className)}>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 p-4',
          'active:bg-muted/50 transition-colors',
          isMobile && 'touch-target'
        )}
      >
        {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
        <div className="flex-1 text-left">
          <div className="font-medium">{title}</div>
          {subtitle && (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          )}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
            {badge}
          </span>
        )}
        {children && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            className="text-muted-foreground"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </motion.div>
        )}
      </button>

      {children && (
        <motion.div
          initial={false}
          animate={{
            height: isExpanded ? 'auto' : 0,
            opacity: isExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="pl-12 pr-4 pb-2">{children}</div>
        </motion.div>
      )}
    </div>
  );
}

// 可选择的列表项
interface SelectableListItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  className?: string;
}

export function SelectableListItem({
  title,
  subtitle,
  description,
  thumbnail,
  selected,
  onSelect,
  onClick,
  className,
}: SelectableListItemProps) {
  const isMobile = useIsMobile();

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-4 border-b border-border last:border-0',
        'active:bg-muted/50 transition-colors cursor-pointer',
        selected && 'bg-primary/5',
        isMobile && 'touch-target py-4',
        className
      )}
    >
      {onSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            selected
              ? 'border-primary bg-primary'
              : 'border-muted-foreground/30'
          )}
        >
          {selected && <Check className="w-4 h-4 text-primary-foreground" />}
        </button>
      )}

      {thumbnail && (
        <img
          src={thumbnail}
          alt={title}
          className="w-16 h-16 rounded-lg object-cover bg-muted"
        />
      )}

      <div className="flex-1 min-w-0">
        <h3 className={cn('font-medium truncate', selected && 'text-primary')}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default MobileListItem;
