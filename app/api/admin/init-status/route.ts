/**
 * 初始化状态检查 API
 * GET /api/admin/init-status - 检查系统是否已初始化
 *
 * 安全说明：
 * - 此 API 只返回后端判断的状态，不信任任何客户端参数
 * - Cookie 只是响应时设置的性能优化，不用于判断
 */

import { NextResponse } from 'next/server';
import { isSystemInitialized } from '@/lib/system/init-check';

export async function GET() {
  try {
    // 后端唯一可信的判断：通过数据库检查
    const isInitialized = await isSystemInitialized();

    const response = NextResponse.json({
      isInitialized,
      needsInit: !isInitialized,
    });

    // 如果已初始化，设置 cookie 作为性能优化
    // 注意：这只是性能优化，不是安全判断依据
    // 后端操作（如初始化 API）会自行验证，不信任此 cookie
    if (isInitialized) {
      response.cookies.set('sys_init', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', // 更严格的 sameSite
        maxAge: 60 * 60 * 24 * 365, // 1 年
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('[Init-Status] 检查初始化状态失败:', err);

    // 服务不可用时返回 503
    return NextResponse.json(
      {
        isInitialized: false,
        needsInit: true,
        error: '服务暂时不可用',
      },
      { status: 503 }
    );
  }
}
