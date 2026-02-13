'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

interface FabAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

interface MobileFabProps {
  actions?: FabAction[];
  mainAction?: () => void;
  mainIcon?: React.ElementType;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  className?: string;
}

export function MobileFab({
  actions,
  mainAction,
  mainIcon: MainIcon = Plus,
  position = 'bottom-right',
  className,
}: MobileFabProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!isMobile) return null;

  const positionClass = {
    'bottom-right': 'right-4 bottom-20',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-20',
    'bottom-left': 'left-4 bottom-20',
  }[position];

  const handleMainClick = () => {
    if (actions && actions.length > 0) {
      setIsOpen(!isOpen);
    } else if (mainAction) {
      mainAction();
    }
  };

  return (
    <div className={cn('fixed z-40', positionClass, className)}>
      <AnimatePresence>
        {isOpen && actions && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 z-[-1]"
            />

            {/* 展开的菜单项 */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col items-center gap-3">
              {actions.map((action, index) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    if (!action.disabled) {
                      action.onClick();
                      setIsOpen(false);
                    }
                  }}
                  disabled={action.disabled}
                  className={cn(
                    'flex items-center gap-3 group',
                    action.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="text-sm font-medium text-white bg-black/60 px-3 py-1 rounded-full whitespace-nowrap">
                    {action.label}
                  </span>
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg',
                      action.color || 'bg-primary'
                    )}
                  >
                    <action.icon className="w-5 h-5" />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* 主按钮 */}
      <motion.button
        onClick={handleMainClick}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center',
          'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
          'transition-all duration-300',
          isOpen && 'rotate-45'
        )}
      >
        <MainIcon className="w-6 h-6" />
      </motion.button>
    </div>
  );
}

// 快捷操作按钮组（用于文章阅读页）
interface QuickActionsProps {
  onMarkRead?: () => void;
  onStar?: () => void;
  onShare?: () => void;
  onRefresh?: () => void;
  isRead?: boolean;
  isStarred?: boolean;
  className?: string;
}

export function MobileQuickActions({
  onMarkRead,
  onStar,
  onShare,
  onRefresh,
  isRead,
  isStarred,
  className,
}: QuickActionsProps) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-2 px-4 py-2',
        'bg-background/95 backdrop-blur-lg rounded-full',
        'border border-border shadow-lg',
        className
      )}
    >
      {onMarkRead && (
        <ActionButton
          onClick={onMarkRead}
          icon={Check}
          label={isRead ? '已读' : '标记已读'}
          isActive={isRead}
          activeColor="text-green-500"
        />
      )}
      {onStar && (
        <ActionButton
          onClick={onStar}
          icon={Sparkles}
          label={isStarred ? '已收藏' : '收藏'}
          isActive={isStarred}
          activeColor="text-yellow-500"
        />
      )}
      {onRefresh && (
        <ActionButton
          onClick={onRefresh}
          icon={RefreshCw}
          label="刷新"
        />
      )}
    </motion.div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  isActive,
  activeColor = 'text-primary',
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 p-3 rounded-full transition-colors',
        'active:scale-95',
        isActive ? activeColor : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className={cn('w-5 h-5', isActive && 'fill-current')} />
    </button>
  );
}

export default MobileFab;
