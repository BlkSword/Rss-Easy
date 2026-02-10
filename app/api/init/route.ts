/**
 * 系统初始化 API
 * 用于记录系统启动日志
 */

import { NextResponse } from 'next/server';
import { info } from '@/lib/logger';

export async function GET() {
  try {
    // 记录系统启动日志
    await info('system', '系统初始化完成', {
      version: process.env.npm_package_version || '1.0.0',
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      message: '系统初始化完成',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('系统初始化失败:', err);
    return NextResponse.json(
      { success: false, message: '初始化失败' },
      { status: 500 }
    );
  }
}
