/**
 * 手动触发调度器 API
 */

import { NextResponse } from 'next/server';
import { getScheduler } from '@/lib/jobs/scheduler';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type = 'fetch' } = body;

    const scheduler = getScheduler();

    if (type === 'fetch') {
      await scheduler.triggerFetch();
    } else if (type === 'ai') {
      await scheduler.triggerAIProcess();
    } else if (type === 'both') {
      await scheduler.triggerFetch();
      await scheduler.triggerAIProcess();
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${type} cycle`,
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
