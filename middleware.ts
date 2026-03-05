/**
 * Next.js 中间件 - 路由保护
 * 增强功能：
 * - 初始化检查（未初始化时跳转到 /init）
 * - 认证检查
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
  '/api/health', // 健康检查，用于启动AI队列
]);

// 静态资源
const staticRoutes = new Set([
  '/_next',
  '/favicon.ico',
  '/public',
]);

/**
 * 检查是否是公开路由
 */
function isPublicRoute(pathname: string): boolean {
  // 检查静态资源
  if (staticRoutes.has(pathname.split('/')[1])) {
    return true;
  }

  // 检查公开路由
  if (publicRoutes.has(pathname)) {
    return true;
  }

  return false;
}

/**
 * 从 cookie 中获取会话 token
 */
function getSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get('session')?.value;
}

/**
 * 检查系统初始化 cookie
 */
function getInitCookie(request: NextRequest): boolean {
  return request.cookies.get('sys_init')?.value === '1';
}

/**
 * 验证 JWT token
 * 使用真正的 JWT 验证而不是简单的长度检查
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
 * 优先使用 cookie 快速检查，失败时调用内部 API
 */
async function checkInitialization(request: NextRequest): Promise<boolean> {
  // 优先检查 cookie（快速路径）
  if (getInitCookie(request)) {
    return true;
  }

  // Cookie 不存在，调用内部 API 检查
  // 使用 localhost 而不是 NEXTAUTH_URL，因为这是容器内部调用
  try {
    // 在 Docker 容器中使用 localhost，在本地开发中使用 127.0.0.1
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'http://localhost:3000'
      : 'http://127.0.0.1:3000';
    const response = await fetch(`${baseUrl}/api/admin/init-status`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.isInitialized === true;
    }
    // 如果 API 返回非 200，返回 false 让用户去初始化页面
    console.error('初始化状态 API 返回错误:', response.status);
    return false;
  } catch (err) {
    // 如果检查失败，返回 false 让用户去初始化页面
    // 这样更安全：宁可多检查一次，也不要跳过初始化
    console.error('检查初始化状态失败:', err);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // 使用 nextUrl 获取 pathname
  const pathname = request.nextUrl.pathname;

  // 获取会话 token
  const sessionToken = getSessionToken(request);

  // 公开路由 - 直接放行
  if (isPublicRoute(pathname)) {
    // 对于 init 路由，检查是否已初始化
    if (pathname === '/init' || pathname === '/api/admin/init') {
      const isInitialized = await checkInitialization(request);
      if (isInitialized) {
        if (pathname === '/api/admin/init') {
          return NextResponse.json(
            { error: '系统已完成初始化' },
            { status: 400 }
          );
        }
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }
    }
    return NextResponse.next();
  }

  // 检查是否已初始化（只检查页面路由，不检查 API 路由）
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    const isInitialized = await checkInitialization(request);

    if (!isInitialized) {
      // 未初始化，跳转到初始化页面
      const initUrl = new URL('/init', request.url);
      return NextResponse.redirect(initUrl);
    }
  }

  // API 路由 - 检查认证
  if (pathname.startsWith('/api/')) {
    if (!sessionToken || !(await isValidToken(sessionToken))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 页面路由 - 检查认证
  if (!sessionToken || !(await isValidToken(sessionToken))) {
    // 保存原始 URL，登录后跳转回来
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
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (favicon 文件)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
