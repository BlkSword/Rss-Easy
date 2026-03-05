/**
 * Next.js 中间件 - 路由保护
 *
 * 运行环境：Edge Runtime（不能使用 Prisma/Node.js APIs）
 *
 * 安全说明：
 * - Cookie (sys_init) 只是性能优化，不是安全判断依据
 * - 后端 API 会自行验证，不信任任何客户端参数
 * - 初始化 API 在执行前会检查数据库中是否有用户存在
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// 公开路由（不需要认证）
const publicRoutes = new Set([
  '/login',
  '/register',
  '/init',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/admin/init',
  '/api/admin/init-status',
  '/api/health',
]);

// 静态资源前缀
const staticPrefixes = ['/_next', '/favicon.ico', '/public', '/images', '/logo.png'];

// 内存缓存（Edge Runtime 兼容）
let initStatusCache: {
  isInitialized: boolean;
  timestamp: number;
} | null = null;

const CACHE_TTL = 30 * 1000; // 30秒

/**
 * 检查是否是静态资源
 */
function isStaticResource(pathname: string): boolean {
  return staticPrefixes.some(prefix => pathname.startsWith(prefix)) ||
    (pathname.includes('.') && !pathname.startsWith('/api/'));
}

/**
 * 检查是否是公开路由
 */
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.has(pathname);
}

/**
 * 从 cookie 中获取会话 token
 */
function getSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get('session')?.value;
}

/**
 * 检查初始化 cookie（性能优化）
 */
function getInitCookie(request: NextRequest): boolean {
  return request.cookies.get('sys_init')?.value === '1';
}

/**
 * 验证 JWT token
 */
async function isValidToken(token: string): Promise<boolean> {
  try {
    await verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查系统是否已初始化
 *
 * 策略（按优先级）：
 * 1. 检查 cookie（快速路径，但不可信）
 * 2. 检查内存缓存
 * 3. 调用内部 API（可信）
 * 4. 如果 API 失败，根据 session 存在性推断
 *
 * 注意：这只是 middleware 层的优化，真正的安全检查在后端 API
 */
async function checkInitialization(request: NextRequest): Promise<boolean> {
  // 1. 快速路径：检查 cookie（性能优化，不是安全判断）
  if (getInitCookie(request)) {
    return true;
  }

  // 2. 检查内存缓存
  const now = Date.now();
  if (initStatusCache && (now - initStatusCache.timestamp) < CACHE_TTL) {
    return initStatusCache.isInitialized;
  }

  // 3. 调用内部 API（可信检查）
  try {
    // 使用内部 URL
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'http://localhost:3000'
      : 'http://127.0.0.1:3000';

    const response = await fetch(`${baseUrl}/api/admin/init-status`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      const isInitialized = data.isInitialized === true;

      // 更新缓存
      initStatusCache = { isInitialized, timestamp: now };

      return isInitialized;
    }

    // 503 服务不可用
    if (response.status === 503 && initStatusCache) {
      // 使用旧缓存
      return initStatusCache.isInitialized;
    }
  } catch (err) {
    console.error('[Middleware] 初始化状态检查失败:', err);
  }

  // 4. 回退策略：如果用户有有效的 session，说明系统已初始化
  const sessionToken = getSessionToken(request);
  if (sessionToken && sessionToken.length > 20) {
    return true;
  }

  // 5. 无法确定，返回 false（让 init 页面自己处理）
  return false;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 静态资源直接放行
  if (isStaticResource(pathname)) {
    return NextResponse.next();
  }

  // 获取会话 token
  const sessionToken = getSessionToken(request);

  // ========== 初始化检查（只检查页面路由） ==========
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    const isInitialized = await checkInitialization(request);

    if (!isInitialized && pathname !== '/init') {
      // 未初始化，重定向到 init 页面
      const initUrl = new URL('/init', request.url);
      return NextResponse.redirect(initUrl);
    }

    if (isInitialized && pathname === '/init') {
      // 已初始化，重定向到首页
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // ========== 公开路由 ==========
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // ========== API 路由认证 ==========
  if (pathname.startsWith('/api/')) {
    // 初始化相关 API 是公开的
    if (pathname === '/api/admin/init' || pathname === '/api/admin/init-status') {
      return NextResponse.next();
    }

    if (!sessionToken || !(await isValidToken(sessionToken))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // ========== 页面路由认证 ==========
  if (!sessionToken || !(await isValidToken(sessionToken))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * 中间件匹配配置
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
