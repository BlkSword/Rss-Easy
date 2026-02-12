/**
 * Next.js 中间件 - 路由保护
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// 公开路由（不需要认证）
const publicRoutes = new Set([
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
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

export async function middleware(request: NextRequest) {
  // 使用 nextUrl 获取 pathname
  const pathname = request.nextUrl.pathname;

  // 获取会话 token
  const sessionToken = getSessionToken(request);

  // 公开路由 - 直接放行
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
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
