/**
 * 报告生成服务
 * 支持日报、周报的AI生成
 */

import { db } from '../db';
import { AIService } from '../ai/client';
import { getNotificationService } from '../notifications/service';
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
  totalRead: number;
  totalFeeds: number;
  categories: Array<{ name: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
}

/**
 * 报告生成服务
 */
export class ReportGenerator {
  private aiService: AIService;

  constructor() {
    // 默认使用 OpenAI
    this.aiService = new AIService({
      provider: 'openai',
      model: 'gpt-4o',
      maxTokens: 4000,
      temperature: 0.7,
    });
  }

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

    if (aiGenerated) {
      // AI生成
      const aiContent = await this.generateAIContent(entries, stats, 'daily', reportDate);
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
        totalRead: stats.totalRead,
        totalFeeds: stats.totalFeeds,
        format: 'markdown',
        content,
        aiGenerated,
        aiModel: aiGenerated ? 'gpt-4o' : null,
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

    if (aiGenerated) {
      // AI生成
      const aiContent = await this.generateAIContent(entries, stats, 'weekly', reportDate);
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
        totalRead: stats.totalRead,
        totalFeeds: stats.totalFeeds,
        format: 'markdown',
        content,
        aiGenerated,
        aiModel: aiGenerated ? 'gpt-4o' : null,
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
    const totalRead = entries.filter((e) => e.isRead).length;

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
      totalRead,
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
    const result = await this.aiService.analyzeArticle(prompt, {
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

    // 构建内容
    let content = `# ${title}\n\n`;
    content += `日期: ${dateStr}\n\n`;

    // 统计概览
    content += `## 📊 统计概览\n\n`;
    content += `- **新增文章**: ${stats.totalEntries} 篇\n`;
    content += `- **已阅读**: ${stats.totalRead} 篇 (${Math.round((stats.totalRead / stats.totalEntries) * 100) || 0}%)\n`;
    content += `- **订阅源**: ${stats.totalFeeds} 个\n\n`;

    // 分类统计
    if (stats.categories.length > 0) {
      content += `## 📁 分类统计\n\n`;
      stats.categories.slice(0, 5).forEach((cat) => {
        content += `- **${cat.name}**: ${cat.count} 篇\n`;
      });
      content += '\n';
    }

    // 主题概览
    if (stats.topTopics.length > 0) {
      content += `## 🏷️ 热门主题\n\n`;
      stats.topTopics.slice(0, 5).forEach((topic) => {
        content += `- **${topic.topic}**: ${topic.count} 篇\n`;
      });
      content += '\n';
    }

    // 精选文章
    content += `## ⭐ 精选文章\n\n`;
    entries.slice(0, 10).forEach((entry, index) => {
      const importanceStars = '⭐'.repeat(Math.round(entry.aiImportanceScore * 5) || 1);
      content += `### ${index + 1}. ${entry.title}\n\n`;
      if (entry.aiSummary) {
        content += `${entry.aiSummary}\n\n`;
      }
      content += `${importanceStars} 重要性: ${(entry.aiImportanceScore * 100).toFixed(0)}%\n`;
      if (entry.aiCategory) {
        content += `分类: ${entry.aiCategory}\n`;
      }
      content += `[阅读全文](${entry.url})\n\n`;
    });

    const summary = `${reportType === 'daily' ? '今日' : '本周'}共新增 ${stats.totalEntries} 篇文章，已阅读 ${stats.totalRead} 篇。热门主题包括：${stats.topTopics.slice(0, 3).map((t) => t.topic).join('、')}。`;

    const highlights = entries.slice(0, 5).map((e) => e.title);

    const topics = {
      topTopics: stats.topTopics.slice(0, 5),
      categories: stats.categories.slice(0, 5),
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

    let prompt = `请为以下内容生成一份${reportType === 'daily' ? '日' : '周'}报，日期：${dateStr}\n\n`;
    prompt += `## 统计数据\n`;
    prompt += `- 新增文章：${stats.totalEntries} 篇\n`;
    prompt += `- 已阅读：${stats.totalRead} 篇\n`;
    prompt += `- 订阅源：${stats.totalFeeds} 个\n\n`;

    prompt += `## 热门主题\n`;
    stats.topTopics.slice(0, 5).forEach((topic) => {
      prompt += `- ${topic.topic}: ${topic.count} 篇\n`;
    });
    prompt += '\n';

    prompt += `## 精选文章\n`;
    entries.slice(0, 10).forEach((entry, index) => {
      prompt += `${index + 1}. ${entry.title}\n`;
      if (entry.aiSummary) {
        prompt += `   摘要：${entry.aiSummary}\n`;
      }
      prompt += `   重要性：${(entry.aiImportanceScore * 100).toFixed(0)}%\n`;
      if (entry.aiCategory) {
        prompt += `   分类：${entry.aiCategory}\n`;
      }
      prompt += '\n';
    });

    prompt += `\n请生成一份结构化的报告，包含：\n`;
    prompt += `1. 概要总结（3-5句话）\n`;
    prompt += `2. 重点内容分析\n`;
    prompt += `3. 趋势洞察\n`;
    prompt += `4. 推荐阅读（按重要性排序）\n\n`;
    prompt += `使用Markdown格式，语言风格简洁专业。`;

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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (reportType === 'daily') {
      return `日报 - ${dateStr}`;
    } else {
      return `周报 - ${dateStr} 当周`;
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
          totalRead: report.totalRead,
          totalFeeds: report.totalFeeds,
        },
        content: report.content,
      },
      null,
      2
    );
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
