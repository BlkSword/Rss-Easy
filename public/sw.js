/**
 * RSS-Post Service Worker
 * 提供离线缓存和 PWA 支持
 *
 * 安全注意事项：
 * - 登录页面不缓存，确保用户始终获取最新版本
 * - 认证相关页面不缓存，防止敏感信息泄露
 */

const CACHE_NAME = 'rss-post-v1';
const STATIC_ASSETS = [
  '/',
  // 注意：登录页面不缓存，确保用户始终获取最新版本
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// 不应该被缓存的路径
const NO_CACHE_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/',
  '/trpc/',
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.log('Cache install failed:', err);
    })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 拦截请求并使用缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过 Chrome 扩展请求
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // 跳过不应该缓存的敏感路径（登录、注册、API 等）
  if (NO_CACHE_PATHS.some(path => url.pathname.startsWith(path))) {
    return;
  }

  // 网络优先策略（适用于 HTML 页面）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 缓存优先策略（适用于静态资源）
  if (
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // 后台更新缓存
          fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  // 默认：网络请求并缓存
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// 处理推送通知
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '您有新的文章更新',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'rss-update',
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: '查看',
      },
      {
        action: 'dismiss',
        title: '忽略',
      },
    ],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'RSS-Post', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = data.url || '/';

      // 如果已有窗口打开，则聚焦并导航
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }

      // 否则打开新窗口
      if (clients.openWindow) {
        clients.openWindow(url);
      }
    })
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-articles') {
    event.waitUntil(syncArticles());
  }
});

async function syncArticles() {
  // 后台同步文章状态的逻辑
  console.log('Background sync triggered');
}
