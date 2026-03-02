/**
 * OPML 导入 API
 * 快速导入：解析即返回，触发调度器自动抓取
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

    // 执行快速导入（触发调度器自动抓取）
    const result = await smartImportOPML(xmlString, {
      userId: session.userId,
      categoryId: categoryId || undefined,
    });

    await info('rss', 'OPML API 快速导入完成', {
      userId: session.userId,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      triggeredFeeds: result.triggeredFeeds,
    });

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      failed: result.failed,
      skipped: result.skipped,
      total: result.total,
      errors: result.errors,
      details: result.details,
      triggeredFeeds: result.triggeredFeeds,
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
