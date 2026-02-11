/**
 * 通知服务
 * 负责创建、管理和发送通知
 */

import { db } from '@/lib/db';
import { info, warn, error } from '@/lib/logger';

export type NotificationType = 'new_entry' | 'report_ready' | 'feed_error' | 'ai_complete' | 'system';

export interface NotificationData {
  entryId?: string;
  feedId?: string;
  reportId?: string;
  feedTitle?: string;
  entryTitle?: string;
  errorCount?: number;
  errorMessage?: string;
  link?: string;
}

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  data?: NotificationData;
}

/**
 * 通知服务类
 */
export class NotificationService {
  /**
   * 创建通知
   */
  async create(options: CreateNotificationOptions): Promise<void> {
    await info('email', '创建通知', {
      userId: options.userId,
      type: options.type,
      title: options.title,
      hasData: !!options.data
    });

    await db.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: options.title,
        content: options.content,
        data: (options.data || {}) as any,
      },
    });
  }

  /**
   * 批量创建通知
   */
  async createBulk(options: CreateNotificationOptions[]): Promise<void> {
    if (options.length === 0) return;

    await info('email', '批量创建通知', {
      userCount: options.length,
      types: [...new Set(options.map(o => o.type))]
    });

    await db.notification.createMany({
      data: options.map((opt) => ({
        userId: opt.userId,
        type: opt.type,
        title: opt.title,
        content: opt.content,
        data: (opt.data || {}) as any,
      })),
    });
  }

  /**
   * 标记为已读
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * 标记所有为已读
   */
  async markAllAsRead(userId: string): Promise<void> {
    await db.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * 删除通知
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await db.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * 清空所有已读通知
   */
  async clearRead(userId: string): Promise<void> {
    await db.notification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });
  }

  /**
   * 获取未读数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await db.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * 获取通知列表
   */
  async getList(userId: string, options: { limit?: number; onlyUnread?: boolean } = {}) {
    const { limit = 50, onlyUnread = false } = options;

    return await db.notification.findMany({
      where: {
        userId,
        ...(onlyUnread && { isRead: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * 创建新文章通知
   */
  async notifyNewEntry(
    userId: string,
    entryId: string,
    feedTitle: string,
    entryTitle: string
  ): Promise<void> {
    await this.create({
      userId,
      type: 'new_entry',
      title: `新文章: ${feedTitle}`,
      content: entryTitle,
      data: {
        entryId,
        feedTitle,
        entryTitle,
        link: `/entries/${entryId}`,
      },
    });
  }

  /**
   * 创建报告就绪通知
   */
  async notifyReportReady(
    userId: string,
    reportId: string,
    reportType: 'daily' | 'weekly',
    reportTitle: string
  ): Promise<void> {
    await info('email', '报告就绪通知已创建', {
      userId,
      reportId,
      reportType,
      reportTitle
    });

    await this.create({
      userId,
      type: 'report_ready',
      title: `${reportType === 'daily' ? '日报' : '周报'}已生成`,
      content: reportTitle,
      data: {
        reportId,
        link: `/reports/${reportId}`,
      },
    });
  }

  /**
   * 创建Feed错误通知
   */
  async notifyFeedError(
    userId: string,
    feedId: string,
    feedTitle: string,
    errorMessage: string,
    errorCount: number
  ): Promise<void> {
    await warn('email', 'Feed错误通知已创建', {
      userId,
      feedId,
      feedTitle,
      errorMessage,
      errorCount
    });

    await this.create({
      userId,
      type: 'feed_error',
      title: `订阅源错误: ${feedTitle}`,
      content: `${errorMessage} (连续失败 ${errorCount} 次)`,
      data: {
        feedId,
        feedTitle,
        errorMessage,
        errorCount,
        link: `/feeds`,
      },
    });
  }

  /**
   * 创建AI分析完成通知
   */
  async notifyAIComplete(
    userId: string,
    entryId: string,
    entryTitle: string
  ): Promise<void> {
    await info('email', 'AI分析完成通知已创建', {
      userId,
      entryId,
      entryTitle
    });

    await this.create({
      userId,
      type: 'ai_complete',
      title: 'AI分析完成',
      content: entryTitle,
      data: {
        entryId,
        entryTitle,
        link: `/entries/${entryId}`,
      },
    });
  }

  /**
   * 创建系统通知
   */
  async notifySystem(userId: string, title: string, content?: string): Promise<void> {
    await this.create({
      userId,
      type: 'system',
      title,
      content,
    });
  }
}

// 单例导出
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
