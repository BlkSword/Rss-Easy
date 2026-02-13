'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
  position?: 'bottom' | 'left' | 'right';
  height?: 'auto' | 'full' | 'half' | '80';
}

export function MobileDrawer({
  isOpen,
  onClose,
  title,
  children,
  showBackButton,
  onBack,
  className,
  position = 'bottom',
  height = 'auto',
}: MobileDrawerProps) {
  const isMobile = useIsMobile();
  const [dragY, setDragY] = useState(0);

  // 处理拖拽关闭
  const handleDrag = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (position === 'bottom') {
        setDragY(Math.max(0, info.offset.y));
      }
    },
    [position]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (position === 'bottom' && info.offset.y > 100) {
        onClose();
      }
      setDragY(0);
    },
    [position, onClose]
  );

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isMobile) {
    // 桌面端使用普通弹窗
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                'bg-background rounded-xl shadow-2xl z-50',
                'w-full max-w-lg max-h-[90vh] overflow-hidden',
                className
              )}
            >
              {(title || showBackButton) && (
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  {showBackButton && (
                    <button
                      onClick={onBack}
                      className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {title && (
                    <h2 className="text-lg font-semibold flex-1">{title}</h2>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 -mr-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  const heightClass = {
    auto: 'max-h-[80vh]',
    full: 'h-[95vh]',
    half: 'h-[50vh]',
    '80': 'h-[80vh]',
  }[height];

  const positionVariants = {
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* 抽屉内容 */}
          <motion.div
            variants={positionVariants[position]}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={position === 'bottom' ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            style={{
              y: dragY,
            }}
            className={cn(
              'fixed z-50 bg-background',
              position === 'bottom' && [
                'bottom-0 left-0 right-0 rounded-t-2xl',
                heightClass,
              ],
              position === 'left' && ['left-0 top-0 bottom-0 w-[85vw] max-w-sm'],
              position === 'right' && ['right-0 top-0 bottom-0 w-[85vw] max-w-sm'],
              className
            )}
          >
            {/* 拖动指示条（仅底部抽屉） */}
            {position === 'bottom' && (
              <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-background z-10">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            {/* 头部 */}
            {(title || showBackButton) && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                {showBackButton && (
                  <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors touch-target"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {title && (
                  <h2 className="text-lg font-semibold flex-1">{title}</h2>
                )}
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 rounded-full hover:bg-muted transition-colors touch-target"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* 内容区域 */}
            <div className="overflow-y-auto p-4" style={{ height: 'calc(100% - 60px)' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// 移动端侧边栏抽屉（替代原侧边栏）
interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileSidebarDrawer({
  isOpen,
  onClose,
  children,
}: MobileSidebarDrawerProps) {
  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      position="left"
      className="bg-card"
    >
      {children}
    </MobileDrawer>
  );
}

export default MobileDrawer;
