/**
 * 富文本内容渲染器
 * 专门用于处理 RSS 抓取的富文本内容（微信公众号等）
 * 支持内联样式、图片、链接等复杂 HTML 结构
 */

'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface RichContentRendererProps {
  html: string;
  className?: string;
}

/**
 * 清理和优化 HTML 内容
 * 处理微信公众号等特殊标签和样式
 */
function sanitizeHTML(html: string): string {
  let cleaned = html;

  // 移除微信公众号特有的无用标签
  cleaned = cleaned
    // 移除 mp-style-type 标签
    .replace(/<mp-style-type[^>]*\/>/gi, '')
    // 移除空的 mp-common-profile 标签
    .replace(/<mp-common-profile[^>]*\/>/gi, '')
    // 移除空的段落
    .replace(/<p[^>]*>\s*<\/p>/gi, '')
    // 移除隐藏的元素
    .replace(/<p[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>.*?<\/p>/gis, '')
    // 移除只有空格的段落
    .replace(/<p[^>]*>\s+<\/p>/gi, '')
    // 移除 data-pm-slice 等微信编辑器属性（保留核心属性）
    .replace(/\s+data-pm-slice="[^"]*"/gi, '')
    .replace(/\s+data-mpa-from-tpl="[^"]*"/gi, '')
    .replace(/\s+data-tools="[^"]*"/gi, '')
    .replace(/\s+data-id="[^"]*"/gi, '')
    .replace(/\s+data-color="[^"]*"/gi, '')
    .replace(/\s+data-width="[^"]*"/gi, '')
    .replace(/\s+data-role="[^"]*"/gi, '')
    .replace(/\s+data-label="[^"]*"/gi, '')
    .replace(/\s+data-pluginname="[^"]*"/gi, '')
    .replace(/\s+data-nickname="[^"]*"/gi, '')
    .replace(/\s+data-alias="[^"]*"/gi, '')
    .replace(/\s+data-from="[^"]*"/gi, '')
    .replace(/\s+data-headimg="[^"]*"/gi, '')
    .replace(/\s+data-signature="[^"]*"/gi, '')
    .replace(/\s+data-is_biz_ban="[^"]*"/gi, '')
    .replace(/\s+data-service_type="[^"]*"/gi, '')
    // 清理嵌套的 div（保留内容）
    .replace(/<div\s+data-pm-slice="[^"]*">(.*?)<\/div>/gis, '<div>$1</div>')
    // 清理多余的嵌套 section 标签
    .replace(/<\/?section[^>]*>/gi, '')
    // 清理微信编辑器的特殊标记
    .replace(/\s+nodeleaf=""/gi, '')
    .replace(/\s+leaf=""/gi, '')
    // 保留图片、链接、标题、段落等常用标签
    ;

  return cleaned;
}

/**
 * 富文本内容渲染器组件
 */
export const RichContentRenderer = memo(function RichContentRenderer({
  html,
  className,
}: RichContentRendererProps) {
  const sanitizedHTML = useMemo(() => sanitizeHTML(html), [html]);

  return (
    <div
      className={cn(
        // 基础容器样式
        'rich-content-container',
        // 字体和排版
        'text-foreground/90',
        // 行高
        'leading-7',
        // 保留内联样式（针对微信公众号等富文本）
        // 图片样式 - 重要：使用 max-w-full 确保图片不会溢出
        '[&_img]:max-w-full',
        '[&_img]:h-auto',
        '[&_img]:rounded-lg',
        '[&_img]:my-4',
        // 微信公众号图片特殊样式
        '[&_.rich_pages]:max-w-full',
        '[&_.wxw-img]:max-w-full',
        '[&_.wxw-img]:h-auto',
        // 链接样式
        '[&_a]:text-primary',
        '[&_a]:underline',
        '[&_a]:underline-offset-2',
        '[&_a]:hover:text-primary/80',
        // 标题样式
        '[&_h1]:text-2xl',
        '[&_h1]:font-bold',
        '[&_h1]:mt-8',
        '[&_h1]:mb-4',
        '[&_h2]:text-xl',
        '[&_h2]:font-semibold',
        '[&_h2]:mt-6',
        '[&_h2]:mb-3',
        '[&_h3]:text-lg',
        '[&_h3]:font-semibold',
        '[&_h3]:mt-5',
        '[&_h3]:mb-2',
        // 段落样式 - 保留原有内联样式
        '[&_p]:my-3',
        // 列表样式
        '[&_ul]:list-disc',
        '[&_ul]:pl-6',
        '[&_ul]:my-3',
        '[&_ol]:list-decimal',
        '[&_ol]:pl-6',
        '[&_ol]:my-3',
        '[&_li]:my-1',
        // 引用样式
        '[&_blockquote]:border-l-4',
        '[&_blockquote]:border-primary/30',
        '[&_blockquote]:pl-4',
        '[&_blockquote]:italic',
        '[&_blockquote]:text-foreground/70',
        '[&_blockquote]:my-4',
        // 代码样式
        '[&_code]:bg-muted',
        '[&_code]:px-1.5',
        '[&_code]:py-0.5',
        '[&_code]:rounded',
        '[&_code]:text-sm',
        '[&_code]:font-mono',
        '[&_pre]:bg-muted/80',
        '[&_pre]:p-4',
        '[&_pre]:rounded-lg',
        '[&_pre]:overflow-x-auto',
        '[&_pre]:my-4',
        // 表格样式
        '[&_table]:w-full',
        '[&_table]:border-collapse',
        '[&_table]:my-4',
        '[&_th]:bg-muted',
        '[&_th]:px-4',
        '[&_th]:py-2',
        '[&_th]:text-left',
        '[&_th]:border',
        '[&_th]:border-border',
        '[&_td]:px-4',
        '[&_td]:py-2',
        '[&_td]:border',
        '[&_td]:border-border',
        // 分隔线样式
        '[&_hr]:my-6',
        '[&_hr]:border-border/40',
        // 视频容器（针对微信公众号视频）
        '[&_iframe]:max-w-full',
        '[&_iframe]:aspect-video',
        '[&_iframe]:rounded-lg',
        // 移除微信公众号特定组件
        '[&_mp-common-profile]:hidden',
        '[&_mp-style-type]:hidden',
        className
      )}
      // 允许所有必要的标签和属性
      // 注意：生产环境建议使用 DOMPurify 等库进行更严格的清理
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
});

/**
 * 文章内容卡片组件
 * 包含标题和富文本渲染器
 */
interface ArticleContentCardProps {
  html: string;
  title?: string;
  className?: string;
}

export function ArticleContentCard({ html, title, className }: ArticleContentCardProps) {
  return (
    <div className={cn('article-content-card', className)}>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <RichContentRenderer html={html} />
    </div>
  );
}

export default RichContentRenderer;
