'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Home,
  Clock,
  Star,
  Archive,
  Settings,
  Plus,
  Search,
  MoreHorizontal,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { useToast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  icon: React.ElementType;
  activeIcon?: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: '首页', href: '/' },
  { icon: Clock, label: '未读', href: '/unread' },
  { icon: Star, label: '星标', href: '/starred' },
];

const moreNavItems: NavItem[] = [
  { icon: Archive, label: '归档', href: '/archive' },
  { icon: Compass, label: '发现', href: '/feeds' },
  { icon: Search, label: '搜索', href: '/search' },
  { icon: Settings, label: '设置', href: '/settings' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [showMore, setShowMore] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { addToast } = useToast();

  // 滚动时隐藏/显示底部导航
  useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, lastScrollY]);

  // 关闭更多菜单当路由变化时
  useEffect(() => {
    setShowMore(false);
  }, [pathname]);

  if (!isMobile) return null;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* 浮动添加按钮 */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: isVisible ? 1 : 0, 
          opacity: isVisible ? 1 : 0 
        }}
        whileTap={{ scale: 0.9 }}
        onClick={() => addToast({ type: 'info', title: '点击了添加按钮' })}
        className={cn(
          'fixed right-4 bottom-20 z-50',
          'w-12 h-12 rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-lg shadow-primary/30',
          'flex items-center justify-center',
          'active:scale-95 transition-transform'
        )}
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* 底部导航栏 */}
      <motion.nav
        initial={false}
        animate={{ 
          y: isVisible ? 0 : 100,
          opacity: isVisible ? 1 : 0 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'bg-background/95 backdrop-blur-xl',
          'border-t border-border/60',
          'safe-area-bottom'
        )}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavItems.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
            />
          ))}
          
          {/* 更多按钮 */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center justify-center',
              'w-16 h-full relative',
              'transition-colors duration-200',
              showMore ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <motion.div
              animate={{ rotate: showMore ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <MoreHorizontal className="w-6 h-6" />
            </motion.div>
            <span className="text-[10px] mt-0.5">更多</span>
            {showMore && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </motion.nav>

      {/* 更多菜单弹层 */}
      <AnimatePresence>
        {showMore && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="fixed inset-0 bg-black/20 z-40"
            />
            
            {/* 菜单面板 */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed bottom-16 left-0 right-0 z-50',
                'bg-background rounded-t-2xl',
                'shadow-2xl shadow-black/20',
                'border-t border-border/60'
              )}
            >
              <div className="p-4">
                {/* 拖动指示条 */}
                <div className="flex justify-center mb-4">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                  {moreNavItems.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-xl',
                          'transition-colors duration-200',
                          isActive(item.href)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <item.icon className="w-6 h-6" />
                        <span className="text-xs">{item.label}</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NavButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex flex-col items-center justify-center',
        'w-16 h-full',
        'transition-colors duration-200',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <motion.div
        whileTap={{ scale: 0.85 }}
        className="relative"
      >
        <item.icon 
          className={cn(
            'w-6 h-6 transition-all duration-200',
            isActive && 'scale-110'
          )} 
        />
        {item.badge !== undefined && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
          />
        )}
      </motion.div>
      <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
    </Link>
  );
}

export default MobileBottomNav;
