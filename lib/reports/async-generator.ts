/**
 * 异步报告生成管理器
 * 支持后台生成报告并实时更新进度
 */

import { db } from '../db';
import { AIService } from '../ai/client';
import { checkAIConfig, getUserAIConfig } from '../ai/health-check';
import { getNotificationService } from '../notifications/service';
import { info, error } from '../logger';
import type { Report, ReportEntry } from '@prisma/client';

// 收集的文章条目（用于AI生成）
interface CollectedEntry {
  entryId: string;
  section: string;
  rank: number;
}

export interface ReportStep {
  step: string;
  label: string;
  status: 'pending' | 'doing' | 'done' | 'error';
  message?: string;
  timestamp?: Date;
}

export interface ReportProgress {
  reportId: string;
  progress: number;
  currentStep: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  steps: ReportStep[];
  errorMessage?: string;
}

// 定义生成步骤
const GENERATION_STEPS: Omit<ReportStep, 'status' | 'timestamp'>[] = [
  { step: 'init', label: '初始化' },
  { step: 'collect_data', label: '收集数据' },
  { step: 'analyze_entries', label: '分析文章' },
  { step: 'generate_summary', label: '生成摘要' },
  { step: 'extract_topics', label: '提取主题' },
  { step: 'select_highlights', label: '精选内容' },
  { step: 'finalize', label: '完成报告' },
];

/**
 * 异步报告生成器
 */
export class AsyncReportGenerator {
  private static instance: AsyncReportGenerator;
  private generatingReports: Map<string, AbortController> = new Map();

  private constructor() {}

  static getInstance(): AsyncReportGenerator {
    if (!AsyncReportGenerator.instance) {
      AsyncReportGenerator.instance = new AsyncReportGenerator();
    }
    return AsyncReportGenerator.instance;
  }

  /**
   * 启动异步生成报告
   */
  async startGeneration(
    userId: string,
    reportType: 'daily' | 'weekly',
    reportDate: Date,
    aiGenerated: boolean = true
  ): Promise<{ success: boolean; report?: Report; error?: string }> {
    try {
      // 1. 检查AI配置（如果需要AI生成）
      if (aiGenerated) {
        const aiConfig = await getUserAIConfig(userId, db);
        const healthCheck = await checkAIConfig(aiConfig);
        
        if (!healthCheck.success) {
          return {
            success: false,
            error: healthCheck.error || healthCheck.message
          };
        }
      }

      // 2. 检查是否已存在相同日期的报告
      const existing = await db.report.findFirst({
        where: {
          userId,
          reportType,
          reportDate,
        },
      });

      if (existing) {
        // 如果报告已完成，直接返回
        if (existing.status === 'completed') {
          return { success: true, report: existing };
        }
        // 如果正在生成中，返回现有报告
        if (existing.status === 'generating' || existing.status === 'pending') {
          return { success: true, report: existing };
        }
        // 如果生成失败，删除旧报告重新生成
        if (existing.status === 'failed') {
          await db.report.delete({ where: { id: existing.id } });
        }
      }

      // 3. 创建报告记录（状态为pending）
      const title = this.generateTitle(reportType, reportDate);
      const report = await db.report.create({
        data: {
          userId,
          reportType,
          reportDate,
          title,
          status: 'pending',
          progress: 0,
          currentStep: '准备开始',
          steps: GENERATION_STEPS.map(s => ({
            ...s,
            status: 'pending',
          })) as any,
          totalEntries: 0,
          totalRead: 0,
          totalFeeds: 0,
          format: 'markdown',
          aiGenerated,
        },
      });

      // 4. 启动后台生成任务
      this.runGeneration(report.id, userId, reportType, reportDate, aiGenerated);

      return { success: true, report };
    } catch (err: any) {
      console.error('启动报告生成失败:', err);
      return {
        success: false,
        error: err.message || '启动生成失败'
      };
    }
  }

  /**
   * 运行生成任务
   */
  private async runGeneration(
    reportId: string,
    userId: string,
    reportType: 'daily' | 'weekly',
    reportDate: Date,
    aiGenerated: boolean
  ): Promise<void> {
    const abortController = new AbortController();
    this.generatingReports.set(reportId, abortController);

    try {
      // 更新状态为生成中
      await this.updateReportStatus(reportId, 'generating', 5, '初始化', 'init');

      // 计算日期范围
      const { startDate, endDate } = this.getDateRange(reportType, reportDate);

      // 步骤1: 收集数据
      await this.updateStepStatus(reportId, 'collect_data', 'doing', '正在收集文章数据...');
      const stats = await this.collectStats(userId, startDate, endDate);
      const entries = await this.collectEntries(userId, startDate, endDate, reportType === 'daily' ? 10 : 20);
      await this.updateStepStatus(reportId, 'collect_data', 'done', `收集到 ${stats.totalEntries} 篇文章`);

      // 更新统计数据
      await db.report.update({
        where: { id: reportId },
        data: {
          totalEntries: stats.totalEntries,
          totalRead: stats.totalRead,
          totalFeeds: stats.totalFeeds,
          progress: 20,
        },
      });

      // 步骤2: 分析文章
      await this.updateStepStatus(reportId, 'analyze_entries', 'doing', '正在分析文章内容...');
      // 模拟分析过程
      await this.delay(1000);
      await this.updateStepStatus(reportId, 'analyze_entries', 'done', '文章分析完成');

      // 步骤3-6: AI生成或模板生成
      let content: string;
      let summary: string;
      let highlights: string[] = [];
      let topics: any;
      let aiConfig: any = null;  // 在外部声明，以便后续使用

      if (aiGenerated) {
        await this.updateStepStatus(reportId, 'generate_summary', 'doing', 'AI正在生成摘要...');

        aiConfig = await getUserAIConfig(userId, db);

        // 创建 AI 服务配置（getUserAIConfig 已解密 apiKey）
        const serviceConfig: any = {
          provider: (aiConfig?.provider as any) || 'openai',
          model: aiConfig?.model || 'gpt-4o',
          baseURL: aiConfig?.baseURL,
          maxTokens: 4000,
          temperature: 0.7,
        };

        // 只有当有 apiKey 时才添加（Ollama 不需要）
        if (aiConfig?.apiKey && serviceConfig.provider !== 'ollama') {
          serviceConfig.apiKey = aiConfig.apiKey;
        }

        const aiService = new AIService(serviceConfig);

        const aiContent = await this.generateAIContent(
          aiService,
          entries,
          stats,
          reportType,
          reportDate,
          reportId,
          aiConfig,
          async (step, message, progress) => {
            await this.updateReportStatus(reportId, 'generating', progress, message, step);
          }
        );

        content = aiContent.content;
        summary = aiContent.summary;
        highlights = aiContent.highlights;
        topics = aiContent.topics;

        await this.updateStepStatus(reportId, 'generate_summary', 'done', '摘要生成完成');
        await this.updateStepStatus(reportId, 'extract_topics', 'done', '主题提取完成');
        await this.updateStepStatus(reportId, 'select_highlights', 'done', `精选 ${highlights.length} 条内容`);
      } else {
        // 模板生成
        const templateContent = this.generateTemplateContent(entries, stats, reportType, reportDate);
        content = templateContent.content;
        summary = templateContent.summary;
        highlights = templateContent.highlights;
        topics = templateContent.topics;

        await this.updateStepStatus(reportId, 'generate_summary', 'done', '摘要生成完成');
        await this.updateStepStatus(reportId, 'extract_topics', 'done', '主题提取完成');
        await this.updateStepStatus(reportId, 'select_highlights', 'done', `精选 ${highlights.length} 条内容`);
      }

      // 步骤7: 完成
      await this.updateStepStatus(reportId, 'finalize', 'doing', '正在保存报告...');

      // 更新报告内容
      await db.report.update({
        where: { id: reportId },
        data: {
          status: 'completed',
          progress: 100,
          currentStep: '生成完成',
          content,
          summary,
          highlights,
          topics: topics as any,
          aiModel: aiGenerated ? aiConfig?.model || 'gpt-4o' : null,
          steps: {
            set: GENERATION_STEPS.map(s => ({
              ...s,
              status: 'done',
              timestamp: new Date(),
            }))
          } as any,
        },
      });

      // 关联文章
      await this.linkEntriesToReport(reportId, entries);

      // 发送通知
      const notificationService = getNotificationService();
      await notificationService.notifyReportReady(
        userId,
        reportId,
        reportType,
        this.generateTitle(reportType, reportDate)
      );

      await info('system', '报告生成完成', { reportId, userId, reportType });

    } catch (err: any) {
      console.error('报告生成失败:', err);
      
      // 更新报告为失败状态
      await db.report.update({
        where: { id: reportId },
        data: {
          status: 'failed',
          errorMessage: err.message || '生成失败',
          currentStep: '生成失败',
        },
      });

      await error('system', '报告生成失败', err, { reportId, userId });
    } finally {
      this.generatingReports.delete(reportId);
    }
  }

  /**
   * 更新报告状态
   */
  private async updateReportStatus(
    reportId: string,
    status: string,
    progress: number,
    currentStep: string,
    stepKey?: string
  ): Promise<void> {
    await db.report.update({
      where: { id: reportId },
      data: {
        status,
        progress,
        currentStep,
      },
    });
  }

  /**
   * 更新步骤状态
   */
  private async updateStepStatus(
    reportId: string,
    stepKey: string,
    status: 'pending' | 'doing' | 'done' | 'error',
    message?: string
  ): Promise<void> {
    const report = await db.report.findUnique({
      where: { id: reportId },
      select: { steps: true }
    });

    const steps = ((report?.steps as any) as ReportStep[]) || GENERATION_STEPS.map(s => ({ ...s, status: 'pending' }));
    const stepIndex = steps.findIndex((s: ReportStep) => s.step === stepKey);
    
    if (stepIndex !== -1) {
      steps[stepIndex] = {
        ...steps[stepIndex],
        status,
        message,
        timestamp: new Date(),
      };

      await db.report.update({
        where: { id: reportId },
        data: { steps: steps as any },
      });
    }
  }

  /**
   * 获取日期范围
   */
  private getDateRange(reportType: 'daily' | 'weekly', reportDate: Date): { startDate: Date; endDate: Date } {
    if (reportType === 'daily') {
      const startDate = new Date(reportDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(reportDate);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    } else {
      const startDate = new Date(reportDate);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  }

  /**
   * 生成标题
   */
  private generateTitle(reportType: 'daily' | 'weekly', reportDate: Date): string {
    const dateStr = reportDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return reportType === 'daily' ? `${dateStr} 日报` : `${dateStr} 周报`;
  }

  /**
   * 收集统计数据
   */
  private async collectStats(userId: string, startDate: Date, endDate: Date) {
    const entries = await db.entry.findMany({
      where: {
        feed: { userId },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { feed: { include: { category: true } } },
    });

    const categories: Record<string, number> = {};
    entries.forEach(e => {
      const cat = e.feed.category?.name || '未分类';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    return {
      totalEntries: entries.length,
      totalRead: entries.filter(e => e.isRead).length,
      totalFeeds: new Set(entries.map(e => e.feedId)).size,
      categories: Object.entries(categories).map(([name, count]) => ({ name, count })),
    };
  }

  /**
   * 收集文章
   */
  private async collectEntries(userId: string, startDate: Date, endDate: Date, limit: number): Promise<CollectedEntry[]> {
    const entries = await db.entry.findMany({
      where: {
        feed: { userId },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { feed: { select: { id: true, title: true } } },
      orderBy: [{ aiImportanceScore: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return entries.map((e, index) => ({
      entryId: e.id,
      section: index < 3 ? 'highlights' : index < 6 ? 'topic' : 'recommendation' as const,
      rank: index + 1,
    }));
  }

  /**
   * 关联文章到报告
   */
  private async linkEntriesToReport(reportId: string, entries: CollectedEntry[]): Promise<void> {
    await db.reportEntry.createMany({
      data: entries.map(e => ({
        reportId,
        entryId: e.entryId,
        section: e.section,
        rank: e.rank,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * AI生成内容
   */
  private async generateAIContent(
    aiService: AIService,
    entries: CollectedEntry[],
    stats: any,
    reportType: 'daily' | 'weekly',
    reportDate: Date,
    reportId: string,
    aiConfig: any,
    onProgress: (step: string, message: string, progress: number) => Promise<void>
  ): Promise<{ content: string; summary: string; highlights: string[]; topics: any }> {
    // 获取文章详情
    const entryDetails = await db.entry.findMany({
      where: { id: { in: entries.map(e => e.entryId) } },
      select: { id: true, title: true, summary: true, content: true, aiSummary: true },
    });

    await onProgress('generate_summary', '正在生成报告摘要...', 40);

    // 生成摘要和主题
    const prompt = this.buildAIPrompt(entryDetails, stats, reportType, reportDate);
    const response = await aiService.chat({
      model: aiConfig?.model || 'gpt-4o',  // 使用用户配置的模型
      messages: [
        { role: 'system', content: '你是一个专业的阅读报告生成助手。请用中文生成报告。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    await onProgress('extract_topics', '正在提取主题...', 60);

    // 解析AI响应
    const aiResponse = this.parseAIResponse(response.content);

    await onProgress('select_highlights', '正在精选内容...', 75);

    return {
      content: aiResponse.content,
      summary: aiResponse.summary,
      highlights: aiResponse.highlights,
      topics: aiResponse.topics,
    };
  }

  /**
   * 构建AI提示词
   */
  private buildAIPrompt(entries: any[], stats: any, reportType: 'daily' | 'weekly', reportDate: Date): string {
    const dateStr = reportDate.toLocaleDateString('zh-CN');
    const period = reportType === 'daily' ? '今天' : '本周';
    
    const entriesText = entries.map((e, i) => 
      `${i + 1}. ${e.title}${e.aiSummary ? `\n   摘要：${e.aiSummary}` : ''}`
    ).join('\n\n');

    return `请为${period}（${dateStr}）生成一份阅读报告。

## 统计数据
- 总文章数：${stats.totalEntries}
- 已读文章：${stats.totalRead}
- 阅读率：${stats.totalEntries > 0 ? Math.round((stats.totalRead / stats.totalEntries) * 100) : 0}%

## 文章列表
${entriesText}

请按以下JSON格式返回报告内容：
{
  "summary": "报告摘要（100字左右）",
  "content": "完整的Markdown格式报告内容",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "topics": {
    "topTopics": [{"topic": "主题名称", "count": 文章数}]
  }
}`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(content: string): { content: string; summary: string; highlights: string[]; topics: any } {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.content || content,
          summary: parsed.summary || '',
          highlights: parsed.highlights || [],
          topics: parsed.topics || { topTopics: [] },
        };
      }
    } catch (e) {
      // 解析失败，返回原始内容
    }

    return {
      content,
      summary: '',
      highlights: [],
      topics: { topTopics: [] },
    };
  }

  /**
   * 模板生成内容
   */
  private generateTemplateContent(entries: any[], stats: any, reportType: 'daily' | 'weekly', reportDate: Date): { content: string; summary: string; highlights: string[]; topics: any } {
    const dateStr = reportDate.toLocaleDateString('zh-CN');
    const title = reportType === 'daily' ? `${dateStr} 日报` : `${dateStr} 周报`;
    
    const content = `# ${title}

## 概览
- 总文章数：${stats.totalEntries}
- 已读文章：${stats.totalRead}
- 阅读率：${stats.totalEntries > 0 ? Math.round((stats.totalRead / stats.totalEntries) * 100) : 0}%

## 精选文章
${entries.slice(0, 5).map((e, i) => `${i + 1}. ${e.title}`).join('\n')}
`;

    return {
      content,
      summary: `共阅读了 ${stats.totalEntries} 篇文章，其中 ${stats.totalRead} 篇已读。`,
      highlights: entries.slice(0, 3).map((e: any) => e.title),
      topics: { topTopics: stats.categories?.slice(0, 3).map((c: any) => ({ topic: c.name, count: c.count })) || [] },
    };
  }

  /**
   * 获取报告进度
   */
  async getProgress(reportId: string, userId: string): Promise<ReportProgress | null> {
    const report = await db.report.findFirst({
      where: { id: reportId, userId },
      select: {
        id: true,
        progress: true,
        currentStep: true,
        status: true,
        steps: true,
        errorMessage: true,
      },
    });

    if (!report) return null;

    return {
      reportId: report.id,
      progress: report.progress,
      currentStep: report.currentStep || '',
      status: report.status as any,
      steps: ((report.steps as any) as ReportStep[]) || [],
      errorMessage: report.errorMessage || undefined,
    };
  }

  /**
   * 取消生成
   */
  async cancelGeneration(reportId: string, userId: string): Promise<boolean> {
    const controller = this.generatingReports.get(reportId);
    if (controller) {
      controller.abort();
      this.generatingReports.delete(reportId);
    }

    await db.report.updateMany({
      where: { id: reportId, userId },
      data: { status: 'failed', errorMessage: '用户取消', currentStep: '已取消' },
    });

    return true;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const asyncReportGenerator = AsyncReportGenerator.getInstance();
