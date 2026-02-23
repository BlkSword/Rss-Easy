/**
 * OPML 导入 API
 * 使用智能导入服务，与添加订阅源流程对齐
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { smartImportOPML, previewOPML } from '@/lib/opml/importer';
import { info, error } from '@/lib/logger';

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
    const skipDiscovery = formData.get('skipDiscovery') === 'true';

    // 预览模式
    if (validateOnly) {
      const preview = await previewOPML(xmlString);
      return NextResponse.json({
        success: preview.success,
        title: preview.title,
        feeds: preview.feeds,
        categories: preview.categories,
        error: preview.error,
      });
    }

    // 执行智能导入
    const result = await smartImportOPML(xmlString, {
      userId: session.userId,
      categoryId: categoryId || undefined,
      skipDiscovery,
    });

    await info('rss', 'OPML API 导入完成', {
      userId: session.userId,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
    });

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      failed: result.failed,
      skipped: result.skipped,
      total: result.total,
      errors: result.errors,
      details: result.details,
    });
  } catch (err) {
    await error('rss', 'OPML API 导入失败', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { error: 'Failed to import OPML file' },
      { status: 500 }
    );
  }
}

/**
 * 预览 OPML 文件
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { opmlContent } = await req.json();

    if (!opmlContent) {
      return NextResponse.json({ error: 'No OPML content provided' }, { status: 400 });
    }

    const preview = await previewOPML(opmlContent);

    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to preview OPML file' },
      { status: 500 }
    );
  }
}
