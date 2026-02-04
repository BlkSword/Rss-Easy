/**
 * OPML 导出 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateOPML } from '@/lib/opml';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const opml = await generateOPML(session.userId);

    return new NextResponse(opml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="rss-easy-feeds-${new Date().toISOString().split('T')[0]}.opml"`,
      },
    });
  } catch (error) {
    console.error('OPML export error:', error);
    return NextResponse.json(
      { error: 'Failed to export OPML file' },
      { status: 500 }
    );
  }
}
