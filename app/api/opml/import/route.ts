/**
 * OPML 导入 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { importOPML } from '@/lib/opml';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.opml') && !file.type.includes('xml')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an OPML file.' },
        { status: 400 }
      );
    }

    const xmlString = await file.text();

    const categoryId = formData.get('categoryId') as string | null;
    const validateOnly = formData.get('validateOnly') === 'true';

    const result = await importOPML(session.userId, xmlString, {
      categoryId: categoryId || undefined,
      validateOnly,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('OPML import error:', error);
    return NextResponse.json(
      { error: 'Failed to import OPML file' },
      { status: 500 }
    );
  }
}
