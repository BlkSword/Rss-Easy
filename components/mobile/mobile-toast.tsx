'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, X, Download } from 'lucide-react';
import { usePWA } from '@/components/providers/pwa-provider';
import { cn } from '@/lib/utils';

// 网络状态提示
export function NetworkStatusToast() {
  const { isOnline } = usePWA();
  const [showToast, setShowToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowToast(true);
    } else if (wasOffline) {
      // 从离线恢复在线，显示恢复提示
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {showToast && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={cn(
            'fixed top-0 left-0 right-0 z-[100] px-4 py-3 safe-area-top',
            isOnline ? 'bg-green-500' : 'bg-amber-500'
          )}
        >
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-2 text-white">
              {isOnline ? (
                <>
                  <Wifi className="w-5 h-5" />
                  <span className="font-medium">网络已恢复</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5" />
                  <span className="font-medium">当前处于离线状态</span>
                </>
              )}
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="p-1 rounded-full hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 安装提示
export function InstallPrompt() {
  const { canInstall, installPrompt, isInstalled } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 检查是否之前已关闭
    const isDismissed = localStorage.getItem('install-prompt-dismissed');
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (canInstall && !dismissed && !isInstalled) {
      // 延迟显示提示
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, dismissed, isInstalled]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  const handleInstall = async () => {
    await installPrompt();
    handleDismiss();
  };

  if (!showPrompt) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-24 left-4 right-4 z-50"
    >
      <div className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">安装 Rss-Easy</h3>
            <p className="text-sm text-primary-foreground/80 mt-1">
              添加到主屏幕，获得更好的阅读体验
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex-1 py-2 px-4 bg-white text-primary rounded-lg font-medium text-sm"
              >
                安装
              </button>
              <button
                onClick={handleDismiss}
                className="py-2 px-4 bg-white/20 rounded-lg font-medium text-sm"
              >
                稍后再说
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// 更新提示
export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // 监听 Service Worker 更新
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdate(true);
      });
    }
  }, []);

  if (!showUpdate) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-24 left-4 right-4 z-50"
    >
      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">发现新版本</h3>
            <p className="text-sm text-muted-foreground mt-1">
              刷新页面以获取最新功能
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
          >
            刷新
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default NetworkStatusToast;
