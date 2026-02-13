'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface PWAContextValue {
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  installPrompt: () => Promise<void>;
  serviceWorkerReady: boolean;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    // 检查是否已安装
    if (typeof window !== 'undefined') {
      // 检测是否在独立模式（已安装）
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);

      // 在线状态
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // 安装提示
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setCanInstall(true);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // 检测安装完成
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setCanInstall(false);
        setDeferredPrompt(null);
      };
      window.addEventListener('appinstalled', handleAppInstalled);

      // 注册 Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration);
            setServiceWorkerReady(true);

            // 检查更新
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // 有新版本可用
                    if (confirm('有新版本可用，是否刷新页面更新？')) {
                      window.location.reload();
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log('SW registration failed:', error);
          });

        // 监听消息
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'SW_UPDATED') {
            console.log('Service Worker updated');
          }
        });
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const installPrompt = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setCanInstall(false);
  };

  return (
    <PWAContext.Provider
      value={{
        isInstalled,
        isOnline,
        canInstall,
        installPrompt,
        serviceWorkerReady,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export default PWAProvider;
