/**
 * PDF 转换服务
 * 将 Markdown 报告转换为 PDF
 */

import { mdToPdf } from 'md-to-pdf';
import path from 'path';
import fs from 'fs/promises';
import { info, error } from '@/lib/logger';

export interface PdfConvertResult {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfPath?: string;
  error?: string;
}

/**
 * 将 Markdown 内容转换为 PDF
 */
export async function convertMarkdownToPdf(
  markdown: string,
  options: {
    title?: string;
    outputPath?: string;
  } = {}
): Promise<PdfConvertResult> {
  try {
    await info('system', '开始转换 Markdown 到 PDF', {
      contentLength: markdown.length,
      title: options.title
    });

    // 配置 PDF 样式
    const pdf = await mdToPdf(
      { content: markdown },
      {
        dest: options.outputPath,
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: `
            <div style="width: 100%; font-size: 10px; padding: 5px 15px; text-align: center; color: #666;">
              ${options.title || '资讯报告'}
            </div>
          `,
          footerTemplate: `
            <div style="width: 100%; font-size: 9px; padding: 5px 15px; text-align: center; color: #999;">
              第 <span class="pageNumber"></span> 页，共 <span class="totalPages"></span> 页
            </div>
          `,
        },
        stylesheet: [
          `
          body {
            font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif;
            font-size: 14px;
            line-height: 1.8;
            color: #333;
          }
          h1 {
            font-size: 24px;
            color: #1a1a1a;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
            margin-top: 30px;
          }
          h2 {
            font-size: 20px;
            color: #1f2937;
            margin-top: 25px;
            padding-left: 10px;
            border-left: 4px solid #2563eb;
          }
          h3 {
            font-size: 16px;
            color: #374151;
            margin-top: 20px;
          }
          h4 {
            font-size: 15px;
            color: #4b5563;
          }
          p {
            margin: 10px 0;
          }
          a {
            color: #2563eb;
            text-decoration: none;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: 600;
          }
          blockquote {
            border-left: 4px solid #d1d5db;
            padding-left: 15px;
            margin: 15px 0;
            color: #6b7280;
            background-color: #f9fafb;
            padding: 10px 15px;
          }
          code {
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: "Consolas", "Monaco", monospace;
            font-size: 13px;
          }
          pre {
            background-color: #1f2937;
            color: #e5e7eb;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
          }
          pre code {
            background-color: transparent;
            padding: 0;
          }
          ul, ol {
            padding-left: 25px;
            margin: 10px 0;
          }
          li {
            margin: 5px 0;
          }
          hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 20px 0;
          }
          strong {
            color: #1f2937;
          }
          `
        ],
        as_html: false,
      }
    );

    if (!pdf) {
      return {
        success: false,
        error: 'PDF 生成失败',
      };
    }

    // mdToPdf 返回 PdfOutput (Buffer | string | undefined)
    // 当不指定 dest 时返回 Buffer
    const pdfBuffer = pdf as unknown as Buffer;

    await info('system', 'PDF 转换成功', {
      pdfSize: pdfBuffer.length
    });

    return {
      success: true,
      pdfBuffer,
      pdfPath: options.outputPath,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await error('system', 'PDF 转换失败', undefined, { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 将 PDF 保存到临时文件
 */
export async function savePdfToTemp(
  pdfBuffer: Buffer,
  filename: string
): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp', 'pdf');

  // 确保目录存在
  await fs.mkdir(tmpDir, { recursive: true });

  const filePath = path.join(tmpDir, filename);
  await fs.writeFile(filePath, pdfBuffer);

  return filePath;
}

/**
 * 清理临时 PDF 文件
 */
export async function cleanupTempPdf(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // 忽略删除错误
  }
}
