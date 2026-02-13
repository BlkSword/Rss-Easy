'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Trash2, Archive, Star, Check } from 'lucide-react';

type SwipeAction = {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  onAction: () => void;
};

interface SwipeableItemProps {
  children: React.ReactNode;
  actions?: SwipeAction[];
  onDelete?: () => void;
  onArchive?: () => void;
  onStar?: () => void;
  onRead?: () => void;
  disabled?: boolean;
  className?: string;
  threshold?: number;
}

export function SwipeableItem({
  children,
  actions: customActions,
  onDelete,
  onArchive,
  onStar,
  onRead,
  disabled = false,
  className,
  threshold = 100,
}: SwipeableItemProps) {
  const [isSwiping, setIsSwiping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 计算背景透明度
  const bgOpacity = useTransform(x, [-threshold, 0], [1, 0]);
  
  // 默认操作
  const defaultActions: SwipeAction[] = [
    ...(onRead ? [{
      id: 'read',
      icon: Check,
      label: '已读',
      color: 'text-green-500',
      bgColor: 'bg-green-500',
      onAction: onRead,
    }] : []),
    ...(onStar ? [{
      id: 'star',
      icon: Star,
      label: '星标',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500',
      onAction: onStar,
    }] : []),
    ...(onArchive ? [{
      id: 'archive',
      icon: Archive,
      label: '归档',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500',
      onAction: onArchive,
    }] : []),
    ...(onDelete ? [{
      id: 'delete',
      icon: Trash2,
      label: '删除',
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      onAction: onDelete,
    }] : []),
  ];

  const actions = customActions || defaultActions;

  const handleDragEnd = useCallback((
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    setIsSwiping(false);
    
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    
    // 快速滑动或超过阈值时触发
    if (offset < -threshold || velocity < -500) {
      setShowActions(true);
      x.set(-Math.min(actions.length * 72, 200));
    } else if (offset > threshold / 2 || velocity > 500) {
      // 向右滑动关闭
      setShowActions(false);
      x.set(0);
    } else {
      // 回弹
      setShowActions(false);
      x.set(0);
    }
  }, [actions.length, threshold, x]);

  const handleAction = useCallback((action: SwipeAction) => {
    action.onAction();
    setShowActions(false);
    x.set(0);
  }, [x]);

  const handleClose = useCallback(() => {
    setShowActions(false);
    x.set(0);
  }, [x]);

  if (disabled || actions.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* 背景操作按钮 */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-end"
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleAction(action)}
                className={cn(
                  'h-full w-[72px] flex flex-col items-center justify-center gap-1',
                  'text-white transition-colors',
                  action.bgColor
                )}
                style={{
                  backgroundColor: action.bgColor.replace('bg-', ''),
                }}
              >
                <action.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{action.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 可滑动内容 */}
      <motion.div
        drag="x"
        dragConstraints={{ left: showActions ? -Math.min(actions.length * 72, 200) : 0, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsSwiping(true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={() => {
          if (showActions) {
            handleClose();
          }
        }}
        className={cn(
          'relative bg-background',
          isSwiping && 'cursor-grabbing',
          showActions && 'shadow-xl'
        )}
      >
        {children}
      </motion.div>

      {/* 遮罩 - 点击关闭 */}
      {showActions && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={handleClose}
        />
      )}
    </div>
  );
}

// 简化的滑动删除版本
interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteText?: string;
  className?: string;
}

export function SwipeToDelete({
  children,
  onDelete,
  deleteText = '删除',
  className,
}: SwipeToDeleteProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const x = useMotionValue(0);
  const controlsRef = useRef<any>(null);

  const handleDragEnd = useCallback((
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } }
  ) => {
    if (info.offset.x < -100) {
      setIsConfirming(true);
      x.set(-120);
    } else {
      setIsConfirming(false);
      x.set(0);
    }
  }, [x]);

  const handleDelete = useCallback(() => {
    onDelete();
    setIsConfirming(false);
    x.set(0);
  }, [onDelete, x]);

  const handleCancel = useCallback(() => {
    setIsConfirming(false);
    x.set(0);
  }, [x]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* 删除背景 */}
      <div className="absolute inset-0 flex items-center justify-end bg-red-500">
        {isConfirming ? (
          <div className="flex items-center h-full">
            <button
              onClick={handleDelete}
              className="h-full px-6 bg-red-600 text-white font-medium active:bg-red-700"
            >
              确认
            </button>
            <button
              onClick={handleCancel}
              className="h-full px-6 bg-gray-400 text-white font-medium active:bg-gray-500"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center px-4 text-white">
            <Trash2 className="w-5 h-5 mr-2" />
            <span>{deleteText}</span>
          </div>
        )}
      </div>

      {/* 内容 */}
      <motion.div
        drag="x"
        dragConstraints={{ left: isConfirming ? -120 : 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
}

export default SwipeableItem;
