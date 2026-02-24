/**
 * 报告生成服务
 * 支持日报、周报的AI生成，以及PDF导出和邮件发送
 */

import { db } from '../db';
import { AIService } from '../ai/client';
import { getNotificationService } from '../notifications/service';
import { getUserAIConfig } from '../ai/health-check';
import { convertMarkdownToPdf } from './pdf-converter';
import { createSystemEmailService } from '../email/service';
import { info, warn, error } from '../logger';
import type { Report, Entry } from '@prisma/client';

export interface ReportEntry {
  entryId: string;
  section: 'highlights' | 'topic' | 'recommendation';
  rank: number;
  notes?: string;
}

export interface ReportGenerateOptions {
  reportType: 'daily' | 'weekly';
  reportDate: Date;
  format?: 'markdown' | 'html' | 'json';
  aiGenerated?: boolean;
}

export interface ReportStats {
  totalEntries: number;
  totalFeeds: number;
  categories: Array<{ name: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
}

/**
 * 报告生成服务
 */
export class ReportGenerator {
  // 移除实例变量，改为按需创建
  constructor() {}

  /**
   * 生成日报
   */
  async generateDailyReport(userId: string, reportDate: Date, aiGenerated = true): Promise<Report> {
    // 检查是否已存在
    const existing = await db.report.findFirst({
      where: {
        userId,
        reportType: 'daily',
        reportDate,
      },
    });

    if (existing) {
      return existing;
    }

    // 获取用户 AI 配置
    const aiConfig = await getUserAIConfig(userId, db);

    // 计算日期范围（当天）
    const startDate = new Date(reportDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);

    // 获取统计数据
    const stats = await this.getStats(userId, startDate, endDate);

    // 获取高优先级文章
    const entries = await this.getTopEntries(userId, startDate, endDate, 10);

    // 生成报告内容
    let content: string;
    let summary: string;
    let highlights: string[] = [];
    let topics: any;
    let aiModel: string | null = null;

    if (aiGenerated) {
      // AI生成 - 使用用户配置
      const aiService = new AIService({
        provider: (aiConfig?.provider as any) || 'openai',
        model: aiConfig?.model || 'gpt-4o',
        apiKey: aiConfig?.apiKey,
        baseURL: aiConfig?.baseURL,
        maxTokens: 4000,
        temperature: 0.7,
      });
      aiModel = aiConfig?.model || 'gpt-4o';

      const aiContent = await this.generateAIContent(aiService, entries, stats, 'daily', reportDate);
      content = aiContent.content;
      summary = aiContent.summary;
      highlights = aiContent.highlights;
      topics = aiContent.topics;
    } else {
      // 模板生成
      const templateContent = await this.generateTemplateContent(entries, stats, 'daily', reportDate);
      content = templateContent.content;
      summary = templateContent.summary;
      highlights = templateContent.highlights;
      topics = templateContent.topics;
    }

    // 创建报告记录
    const report = await db.report.create({
      data: {
        userId,
        reportType: 'daily',
        reportDate,
        title: this.generateTitle('daily', reportDate),
        summary,
        highlights,
        topics,
        totalEntries: stats.totalEntries,
        totalFeeds: stats.totalFeeds,
        format: 'markdown',
        content,
        aiGenerated,
        aiModel,
      },
    });

    // 关联文章
    await this.linkEntriesToReport(report.id, entries);

    // 发送报告就绪通知
    const notificationService = getNotificationService();
    await notificationService.notifyReportReady(
      userId,
      report.id,
      'daily',
      report.title
    );

    return report;
  }

  /**
   * 生成周报
   */
  async generateWeeklyReport(userId: string, reportDate: Date, aiGenerated = true): Promise<Report> {
    // 检查是否已存在
    const existing = await db.report.findFirst({
      where: {
        userId,
        reportType: 'weekly',
        reportDate,
      },
    });

    if (existing) {
      return existing;
    }

    // 获取用户 AI 配置
    const aiConfig = await getUserAIConfig(userId, db);

    // 计算日期范围（本周）
    const startDate = new Date(reportDate);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 周一
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // 周日
    endDate.setHours(23, 59, 59, 999);

    // 获取统计数据
    const stats = await this.getStats(userId, startDate, endDate);

    // 获取高优先级文章
    const entries = await this.getTopEntries(userId, startDate, endDate, 20);

    // 生成报告内容
    let content: string;
    let summary: string;
    let highlights: string[] = [];
    let topics: any;
    let aiModel: string | null = null;

    if (aiGenerated) {
      // AI生成 - 使用用户配置
      const aiService = new AIService({
        provider: (aiConfig?.provider as any) || 'openai',
        model: aiConfig?.model || 'gpt-4o',
        apiKey: aiConfig?.apiKey,
        baseURL: aiConfig?.baseURL,
        maxTokens: 4000,
        temperature: 0.7,
      });
      aiModel = aiConfig?.model || 'gpt-4o';

      const aiContent = await this.generateAIContent(aiService, entries, stats, 'weekly', reportDate);
      content = aiContent.content;
      summary = aiContent.summary;
      highlights = aiContent.highlights;
      topics = aiContent.topics;
    } else {
      // 模板生成
      const templateContent = await this.generateTemplateContent(entries, stats, 'weekly', reportDate);
      content = templateContent.content;
      summary = templateContent.summary;
      highlights = templateContent.highlights;
      topics = templateContent.topics;
    }

    // 创建报告记录
    const report = await db.report.create({
      data: {
        userId,
        reportType: 'weekly',
        reportDate,
        title: this.generateTitle('weekly', reportDate),
        summary,
        highlights,
        topics,
        totalEntries: stats.totalEntries,
        totalFeeds: stats.totalFeeds,
        format: 'markdown',
        content,
        aiGenerated,
        aiModel,
      },
    });

    // 关联文章
    await this.linkEntriesToReport(report.id, entries);

    // 发送报告就绪通知
    const notificationService = getNotificationService();
    await notificationService.notifyReportReady(
      userId,
      report.id,
      'weekly',
      report.title
    );

    return report;
  }

  /**
   * 获取统计数据
   */
  private async getStats(userId: string, startDate: Date, endDate: Date): Promise<ReportStats> {
    // 获取总文章数和阅读数
    const entries = await db.entry.findMany({
      where: {
        feed: {
          userId,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        feed: {
          include: {
            category: true,
          },
        },
      },
    });

    const totalEntries = entries.length;

    // 获取订阅源数量
    const feeds = await db.feed.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    const totalFeeds = feeds.length;

    // 按分类统计
    const categoryMap = new Map<string, number>();
    entries.forEach((entry) => {
      const categoryName = entry.feed.category?.name || '未分类';
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
    });

    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 按主题统计（使用AI分类）
    const topicMap = new Map<string, number>();
    entries.forEach((entry) => {
      if (entry.aiCategory) {
        topicMap.set(entry.aiCategory, (topicMap.get(entry.aiCategory) || 0) + 1);
      }
    });

    const topTopics = Array.from(topicMap.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries,
      totalFeeds,
      categories,
      topTopics,
    };
  }

  /**
   * 获取高优先级文章
   */
  private async getTopEntries(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<Entry[]> {
    return db.entry.findMany({
      where: {
        feed: {
          userId,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { aiImportanceScore: 'desc' },
        { publishedAt: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * AI生成内容
   */
  private async generateAIContent(
    aiService: AIService,
    entries: Entry[],
    stats: ReportStats,
    reportType: 'daily' | 'weekly',
    reportDate: Date
  ): Promise<{
    content: string;
    summary: string;
    highlights: string[];
    topics: any;
  }> {
    // 构建提示词
    const prompt = this.buildPrompt(entries, stats, reportType, reportDate);

    // 调用AI生成
    const result = await aiService.analyzeArticle(prompt, {
      summary: true,
      keywords: true,
      category: false,
      sentiment: false,
      importance: false,
    });

    // 解析AI响应
    const aiContent = result.summary || '';

    // 提取高亮内容
    const highlights = entries.slice(0, 5).map((e) => e.title);

    // 构建主题数据
    const topics = {
      topTopics: stats.topTopics.slice(0, 5),
      categories: stats.categories.slice(0, 5),
    };

    // 构建完整内容
    const content = await this.formatReportContent(aiContent, entries, stats, reportType);

    return {
      content,
      summary: aiContent.slice(0, 200),
      highlights,
      topics,
    };
  }

  /**
   * 模板生成内容
   */
  private generateTemplateContent(
    entries: Entry[],
    stats: ReportStats,
    reportType: 'daily' | 'weekly',
    reportDate: Date
  ): Promise<{
    content: string;
    summary: string;
    highlights: string[];
    topics: any;
  }> {
    const title = this.generateTitle(reportType, reportDate);
    const dateStr = reportDate.toLocaleDateString('zh-CN');
    const dateRange = reportType === 'daily' ? dateStr : `${dateStr} 当周`;

    // 按分类分组文章
    const entriesByCategory = new Map<string, Entry[]>();
    entries.forEach((entry) => {
      const category = entry.aiCategory || '其他';
      if (!entriesByCategory.has(category)) {
        entriesByCategory.set(category, []);
      }
      entriesByCategory.get(category)!.push(entry);
    });

    // 按文章数量排序分类
    const sortedCategories = Array.from(entriesByCategory.entries())
      .sort((a, b) => b[1].length - a[1].length);

    // 构建内容
    let content = `# ${title}\n\n`;
    content += `> 时间范围：${dateRange}\n\n`;

    // 一、整体热度概览
    content += `## 一、整体热度概览\n\n`;
    content += `本期共收录 **${stats.totalEntries}** 篇文章，来自 **${stats.totalFeeds}** 个订阅源。`;

    if (stats.topTopics.length > 0) {
      content += `热门话题集中在：**${stats.topTopics.slice(0, 5).map(t => t.topic).join('**、**')}** 等领域。`;
    }
    content += '\n\n';

    // 热度分布表格
    if (stats.topTopics.length > 0) {
      content += `| 热门话题 | 文章数 |\n`;
      content += `|---------|-------|\n`;
      stats.topTopics.slice(0, 8).forEach((topic) => {
        content += `| ${topic.topic} | ${topic.count} |\n`;
      });
      content += '\n';
    }

    // 按分类生成章节
    let sectionIndex = 2;
    const categoryNames: string[] = ['整体热度概览'];

    sortedCategories.forEach(([category, categoryEntries]) => {
      const chineseNum = ['二', '三', '四', '五', '六', '七', '八', '九', '十'][sectionIndex - 2] || String(sectionIndex);
      content += `## ${chineseNum}、${category}\n\n`;

      categoryNames.push(category);

      // 按重要性排序
      const sortedEntries = categoryEntries.sort((a, b) => b.aiImportanceScore - a.aiImportanceScore);

      sortedEntries.slice(0, 10).forEach((entry, index) => {
        content += `### ${index + 1}. ${entry.title}\n\n`;

        // 时间
        if (entry.publishedAt) {
          content += `**时间**：${entry.publishedAt.toLocaleDateString('zh-CN')}\n\n`;
        }

        // 核心信息
        content += `**核心信息**：\n`;
        if (entry.aiSummary) {
          // 将摘要拆分为要点
          const points = entry.aiSummary.split(/[。！？\n]/).filter(p => p.trim().length > 0).slice(0, 3);
          if (points.length > 0) {
            points.forEach(point => {
              content += `- ${point.trim()}\n`;
            });
          } else {
            content += `- ${entry.aiSummary}\n`;
          }
        } else if (entry.content) {
          // 从内容提取前200字符作为摘要
          const snippet = entry.content.replace(/<[^>]*>/g, '').substring(0, 200).trim();
          content += `- ${snippet}...\n`;
        } else {
          content += `- 暂无摘要\n`;
        }
        content += '\n';

        // 来源
        content += `**来源**：[${entry.url}](${entry.url})\n\n`;

        // 重要性评分
        const score = Math.round(entry.aiImportanceScore * 100);
        if (score > 0) {
          content += `> 重要性评分：${score}%\n\n`;
        }

        content += '---\n\n';
      });

      sectionIndex++;
    });

    // 小结
    const summaryChineseNum = ['二', '三', '四', '五', '六', '七', '八', '九', '十'][sectionIndex - 2] || String(sectionIndex);
    content += `## ${summaryChineseNum}、小结\n\n`;
    content += `本期${reportType === 'daily' ? '日报' : '周报'}要点：\n\n`;

    // 生成小结要点
    content += `1. **内容概览**：共收录 ${stats.totalEntries} 篇文章，涵盖 ${sortedCategories.length} 个主要领域。\n`;

    if (stats.topTopics.length > 0) {
      content += `2. **热门话题**：${stats.topTopics.slice(0, 3).map(t => t.topic).join('、')} 是本期最受关注的话题。\n`;
    }

    if (sortedCategories.length > 0) {
      const topCategory = sortedCategories[0];
      content += `3. **重点关注**：${topCategory[0]} 领域文章最多（${topCategory[1].length} 篇），建议优先关注。\n`;
    }

    const summary = `${reportType === 'daily' ? '今日' : '本周'}共收录 ${stats.totalEntries} 篇文章，涵盖 ${sortedCategories.length} 个领域。热门话题：${stats.topTopics.slice(0, 3).map(t => t.topic).join('、')}。`;

    const highlights = entries.slice(0, 5).map((e) => e.title);

    const topics = {
      topTopics: stats.topTopics.slice(0, 10),
      categories: stats.categories.slice(0, 10),
      categoryNames,
    };

    return Promise.resolve({
      content,
      summary,
      highlights,
      topics,
    });
  }

  /**
   * 构建AI提示词
   */
  private buildPrompt(
    entries: Entry[],
    stats: ReportStats,
    reportType: 'daily' | 'weekly',
    reportDate: Date
  ): string {
    const dateStr = reportDate.toLocaleDateString('zh-CN');
    const dateRange = reportType === 'daily'
      ? dateStr
      : `${dateStr} 当周`;

    let prompt = `你是一位专业的科技资讯分析师。请根据以下文章数据，生成一份结构化的${reportType === 'daily' ? '日' : '周'}报。

## 报告要求

请严格按照以下格式生成报告：

### 一、整体热度概览
用2-3句话概括本期最重要的热点趋势，说明各领域的热度分布情况。

### 二、[领域名称1]（按文章数量降序排列）
为每个领域生成独立章节，每个领域下按重要性排列文章：

#### 1. [文章标题]
- **时间**：发布日期
- **核心信息**：
  - [要点1]
  - [要点2]
  - [要点3]
- **来源**：订阅源名称

#### 2. [文章标题]
...

### 三、[领域名称2]
...

### [N]、小结
用3-5个要点总结本期主线趋势和关键洞察。

---

## 输入数据

**日期范围**：${dateRange}
**文章总数**：${stats.totalEntries} 篇
**订阅源数量**：${stats.totalFeeds} 个

### 热门主题分布
`;
    stats.topTopics.slice(0, 10).forEach((topic) => {
      prompt += `- ${topic.topic}: ${topic.count} 篇\n`;
    });

    prompt += `\n### 分类分布\n`;
    stats.categories.slice(0, 10).forEach((cat) => {
      prompt += `- ${cat.name}: ${cat.count} 篇\n`;
    });

    prompt += `\n### 精选文章（按重要性排序）\n`;
    entries.slice(0, 15).forEach((entry, index) => {
      prompt += `\n---\n**${index + 1}. ${entry.title}**\n`;
      if (entry.publishedAt) {
        prompt += `发布时间：${entry.publishedAt.toLocaleDateString('zh-CN')}\n`;
      }
      if (entry.aiSummary) {
        prompt += `AI摘要：${entry.aiSummary}\n`;
      }
      prompt += `重要性评分：${(entry.aiImportanceScore * 100).toFixed(0)}%\n`;
      if (entry.aiCategory) {
        prompt += `分类：${entry.aiCategory}\n`;
      }
      if (entry.aiKeywords && entry.aiKeywords.length > 0) {
        prompt += `关键词：${entry.aiKeywords.slice(0, 5).join('、')}\n`;
      }
    });

    prompt += `\n---

## 注意事项
1. 将文章按领域/主题分组，每个领域独立成章
2. 领域名称要简洁专业，如"人工智能"、"网络安全"、"芯片半导体"、"云计算"等
3. 每篇文章的核心信息要提炼3个以内的关键要点
4. 语言风格要简洁专业，避免冗余
5. 使用中文输出，Markdown格式`;

    return prompt;
  }

  /**
   * 格式化报告内容
   */
  private async formatReportContent(
    aiContent: string,
    entries: Entry[],
    stats: ReportStats,
    reportType: 'daily' | 'weekly'
  ): Promise<string> {
    // 如果AI返回了完整内容，直接使用
    if (aiContent.includes('#') && aiContent.length > 200) {
      return aiContent;
    }

    // 否则使用模板格式化
    const templateContent = await this.generateTemplateContent(entries, stats, reportType, new Date());
    return templateContent.content;
  }

  /**
   * 生成报告标题
   */
  private generateTitle(reportType: 'daily' | 'weekly', reportDate: Date): string {
    const dateStr = reportDate.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
    });

    if (reportType === 'daily') {
      return `资讯日报 · ${dateStr}`;
    } else {
      const endDate = new Date(reportDate);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = endDate.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
      });
      return `资讯周报 · ${dateStr} - ${endDateStr}`;
    }
  }

  /**
   * 关联文章到报告
   */
  private async linkEntriesToReport(reportId: string, entries: Entry[]): Promise<void> {
    const reportEntries = entries.map((entry, index) => ({
      reportId,
      entryId: entry.id,
      section: (index < 5 ? 'highlights' : index < 15 ? 'topic' : 'recommendation') as 'highlights' | 'topic' | 'recommendation',
      rank: index + 1,
    }));

    await db.reportEntry.createMany({
      data: reportEntries,
      skipDuplicates: true,
    });
  }

  /**
   * 转换报告格式
   */
  async convertReportFormat(reportId: string, targetFormat: 'markdown' | 'html' | 'json'): Promise<string> {
    const report = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('Report not found');
    }

    if (report.format === targetFormat) {
      return report.content || '';
    }

    switch (targetFormat) {
      case 'html':
        return this.markdownToHtml(report.content || '');
      case 'json':
        return this.reportToJson(report);
      default:
        return report.content || '';
    }
  }

  /**
   * Markdown转HTML
   */
  private markdownToHtml(markdown: string): string {
    // 简单的Markdown到HTML转换
    // 实际项目中应该使用专业的markdown解析库
    let html = markdown;

    // 标题
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 粗体和斜体
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2">$1</a>');

    // 列表
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

    // 段落
    html = html.split('\n\n').map(p => `<p>${p}</p>`).join('');

    return html;
  }

  /**
   * 报告转JSON
   */
  private reportToJson(report: Report): string {
    return JSON.stringify(
      {
        id: report.id,
        type: report.reportType,
        date: report.reportDate,
        title: report.title,
        summary: report.summary,
        highlights: report.highlights,
        topics: report.topics,
        stats: {
          totalEntries: report.totalEntries,
          totalFeeds: report.totalFeeds,
        },
        content: report.content,
      },
      null,
      2
    );
  }

  /**
   * 生成报告 PDF
   */
  async generateReportPdf(reportId: string): Promise<Buffer | null> {
    const report = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!report || !report.content) {
      await warn('system', '无法生成 PDF：报告不存在或内容为空', { reportId });
      return null;
    }

    const pdfResult = await convertMarkdownToPdf(report.content, {
      title: report.title,
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      await error('system', 'PDF 生成失败', undefined, {
        reportId,
        error: pdfResult.error
      });
      return null;
    }

    await info('system', 'PDF 生成成功', {
      reportId,
      pdfSize: pdfResult.pdfBuffer.length
    });

    return pdfResult.pdfBuffer;
  }

  /**
   * 发送报告邮件（包含 PDF 附件）
   */
  async sendReportEmail(
    userId: string,
    reportId: string
  ): Promise<{ success: boolean; error?: string }> {
    // 获取用户邮箱
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });

    if (!user?.email) {
      await warn('email', '无法发送报告邮件：用户邮箱不存在', { userId, reportId });
      return { success: false, error: '用户邮箱不存在' };
    }

    // 获取报告信息
    const report = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: '报告不存在' };
    }

    // 检查邮件服务是否可用
    const emailService = createSystemEmailService();
    if (!emailService) {
      await warn('email', '邮件服务未配置，跳过发送', { userId, reportId });
      return { success: false, error: '邮件服务未配置' };
    }

    // 生成 PDF
    let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
    const pdfBuffer = await this.generateReportPdf(reportId);

    if (pdfBuffer) {
      const dateStr = report.reportDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\//g, '-');
      const reportTypeText = report.reportType === 'daily' ? '日报' : '周报';

      pdfAttachment = {
        filename: `${reportTypeText}_${dateStr}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      };
    }

    // 发送邮件
    const result = await emailService.sendReportEmail(
      user.email,
      user.username,
      {
        id: report.id,
        title: report.title,
        reportType: report.reportType as 'daily' | 'weekly',
        reportDate: report.reportDate,
        summary: report.summary,
        content: report.content,
        highlights: report.highlights as string[],
        totalEntries: report.totalEntries,
        totalFeeds: report.totalFeeds,
      },
      pdfAttachment
    );

    if (result.success) {
      await info('email', '报告邮件发送成功', {
        userId,
        reportId,
        to: user.email,
        hasPdf: !!pdfAttachment
      });
    }

    return { success: result.success, error: result.error };
  }

  /**
   * 生成报告并发送邮件
   */
  async generateAndSendReport(
    userId: string,
    reportType: 'daily' | 'weekly',
    reportDate: Date,
    aiGenerated = true,
    sendEmail = true
  ): Promise<Report> {
    // 生成报告
    const report = reportType === 'daily'
      ? await this.generateDailyReport(userId, reportDate, aiGenerated)
      : await this.generateWeeklyReport(userId, reportDate, aiGenerated);

    // 发送邮件
    if (sendEmail) {
      // 异步发送邮件，不阻塞报告生成
      this.sendReportEmail(userId, report.id).catch(async (err) => {
        await error('email', '报告邮件发送失败', undefined, {
          userId,
          reportId: report.id,
          error: err instanceof Error ? err.message : String(err)
        });
      });
    }

    return report;
  }
}

// 导出单例实例
let reportGeneratorInstance: ReportGenerator | null = null;

export function getReportGenerator(): ReportGenerator {
  if (!reportGeneratorInstance) {
    reportGeneratorInstance = new ReportGenerator();
  }
  return reportGeneratorInstance;
}
