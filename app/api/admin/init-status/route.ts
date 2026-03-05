/**
 * 初始化状态检查 API
 * GET /api/admin/init-status - 检查系统是否已初始化
 */

import { NextResponse } from 'next/server';
import { isSystemInitialized, needsInitialization } from '@/lib/system/init-check';

export async function GET() {
  try {
    const isInitialized = await isSystemInitialized();
    const needsInit = await needsInitialization();

    const response = NextResponse.json({
      isInitialized,
      needsInit,
    });

    // 如果已初始化，设置 cookie 以便 middleware 快速检查
    if (isInitialized) {
      response.cookies.set('sys_init', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 年
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('检查初始化状态失败:', err);

    // 发生错误时，返回 false 让用户去初始化页面
    // 这样更安全：宁可让用户重新初始化，也不要跳过
    return NextResponse.json({
      isInitialized: false,
      needsInit: true,
      error: '检查初始化状态失败',
    });
  }
}
