/**
 * 调度器状态 API
 */

import { NextResponse } from 'next/server';
import { getScheduler } from '@/lib/jobs/scheduler';

export async function GET() {
  try {
    const scheduler = getScheduler();
    const status = scheduler.getStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
