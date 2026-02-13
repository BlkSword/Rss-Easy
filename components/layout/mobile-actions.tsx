'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Check,
  Archive,
  Star,
  Trash2,
  MoreVertical,
  X,
  RefreshCw,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/ui/toast';

interface MobileActionButton {
  id: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'warning';
}

interface MobileActionsProps {
  actions?: MobileActionButton[];
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  onFilter?: () => void;
  onSearch?: () => void;
  showAddButton?: boolean;
  onAdd?: () => void;
}

export function MobileActions({
  actions: customActions,
  onRefresh,
  onMarkAllRead,
  onFilter,
  onSearch,
  showAddButton = true,
  onAdd,
}: MobileActionsProps) {
  const isMobile = useIsMobile();
  const [showMenu, setShowMenu] = useState(false);
  const { resolvedTheme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  if (!isMobile) return null;

  const handleRefresh = () => {
    onRefresh?.();
    addToast({ type: 'success', title: '刷新中...' });
    setShowMenu(false);
  };

  const handleMarkAllRead = () => {
    onMarkAllRead?.();
    addToast({ type: 'success', title: '已标记全部已读' });
    setShowMenu(false);
  };

  const defaultActions: MobileActionButton[] = [
    ...(onRefresh ? [{
      id: 'refresh',
      icon: RefreshCw,
      label: '刷新',
      onClick: handleRefresh,
    }] : []),
    ...(onMarkAllRead ? [{
      id: 'mark-read',
      icon: Check,
      label: '全部已读',
      onClick: handleMarkAllRead,
    }] : []),
    ...(onFilter ? [{
      id: 'filter',
      icon: Filter,
      label: '筛选',
      onClick: () => { onFilter(); setShowMenu(false); },
    }] : []),
    ...(onSearch ? [{
      id: 'search',
      icon: Search,
      label: '搜索',
      onClick: () => { onSearch(); setShowMenu(false); },
    }] : []),
    {
      id: 'theme',
      icon: resolvedTheme === 'dark' ? Sun : Moon,
      label: resolvedTheme === 'dark' ? '切换亮色' : '切换暗色',
      onClick: () => { toggleTheme(); setShowMenu(false); },
    },
  ];

  const actions = customActions || defaultActions;

  return (
    <>
      {/* 浮动操作按钮组 */}
      <div className="fixed right-4 bottom-20 z-40 flex flex-col gap-3">
        <AnimatePresence>
          {showMenu && (
            <>
              {actions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ scale: 0, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0, opacity: 0, y: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={action.onClick}
                  className={cn(
                    'flex items-center gap-3 pr-4 pl-3 py-2 rounded-full',
                    'bg-background shadow-lg border border-border/60',
                    'active:scale-95 transition-transform'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    action.variant === 'primary' && 'bg-primary text-primary-foreground',
                    action.variant === 'danger' && 'bg-red-500 text-white',
                    action.variant === 'warning' && 'bg-yellow-500 text-white',
                    (!action.variant || action.variant === 'default') && 'bg-muted'
                  )}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
                </motion.button>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* 主按钮 */}
        {showAddButton && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onAdd ? onAdd() : setShowMenu(!showMenu)}
            className={cn(
              'w-14 h-14 rounded-full',
              'bg-primary text-primary-foreground',
              'shadow-lg shadow-primary/30',
              'flex items-center justify-center',
              'active:scale-95 transition-all duration-200'
            )}
          >
            <motion.div
              animate={{ rotate: showMenu ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {onAdd ? <Plus className="w-6 h-6" /> : <MoreVertical className="w-6 h-6" />}
            </motion.div>
          </motion.button>
        )}
      </div>

      {/* 遮罩 */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMenu(false)}
            className="fixed inset-0 bg-black/20 z-30"
          />
        )}
      </AnimatePresence>
    </>
  );
}

// 文章详情页的快捷操作
interface ArticleActionsProps {
  isStarred: boolean;
  isRead: boolean;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onShare?: () => void;
  onArchive?: () => void;
}

export function ArticleActions({
  isStarred,
  isRead,
  onToggleStar,
  onToggleRead,
  onShare,
  onArchive,
}: ArticleActionsProps) {
  const isMobile = useIsMobile();
  const [showActions, setShowActions] = useState(false);

  if (!isMobile) return null;

  return (
    <>
      {/* 底部固定操作栏 */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'bg-background/95 backdrop-blur-xl border-t border-border/60',
          'safe-area-bottom px-4 py-3'
        )}
      >
        <div className="flex items-center justify-around">
          <ActionButton
            icon={Check}
            label={isRead ? '已读' : '未读'}
            isActive={isRead}
            activeColor="text-green-500"
            onClick={onToggleRead}
          />
          <ActionButton
            icon={Star}
            label={isStarred ? '已星标' : '星标'}
            isActive={isStarred}
            activeColor="text-yellow-500"
            onClick={onToggleStar}
          />
          {onArchive && (
            <ActionButton
              icon={Archive}
              label="归档"
              onClick={onArchive}
            />
          )}
          {onShare && (
            <ActionButton
              icon={ShareIcon}
              label="分享"
              onClick={onShare}
            />
          )}
          <ActionButton
            icon={MoreVertical}
            label="更多"
            onClick={() => setShowActions(true)}
          />
        </div>
      </motion.div>

      {/* 更多操作面板 */}
      <AnimatePresence>
        {showActions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowActions(false)}
              className="fixed inset-0 bg-black/40 z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-50',
                'bg-background rounded-t-2xl',
                'p-4 pb-safe'
              )}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold mb-4">更多操作</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors">
                  <Settings className="w-5 h-5" />
                  <span>阅读设置</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-red-500">
                  <Trash2 className="w-5 h-5" />
                  <span>删除文章</span>
                </button>
              </div>
              <button
                onClick={() => setShowActions(false)}
                className="w-full mt-4 py-3 text-center font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  isActive,
  activeColor = 'text-primary',
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  activeColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-3 py-2 rounded-xl',
        'transition-colors duration-200',
        'active:scale-95'
      )}
    >
      <Icon className={cn(
        'w-5 h-5 transition-colors',
        isActive ? activeColor : 'text-muted-foreground'
      )} />
      <span className={cn(
        'text-[10px] transition-colors',
        isActive ? activeColor : 'text-muted-foreground'
      )}>
        {label}
      </span>
    </button>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export default MobileActions;
