/**
 * 订阅规则引擎
 * 用于根据用户定义的条件自动执行动作
 */

import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * 规则条件定义
 */
export interface RuleCondition {
  field: 'title' | 'content' | 'author' | 'category' | 'tag' | 'feedTitle';
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'matches' | 'in' | 'gt' | 'lt';
  value: string | string[] | number;
}

/**
 * 规则动作定义
 */
export interface RuleAction {
  type: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'assignCategory' | 'addTag' | 'removeTag' | 'skip';
  params?: Record<string, any>;
}

/**
 * 规则定义
 */
export interface SubscriptionRule {
  id: string;
  userId: string;
  name: string;
  isEnabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  matchedCount: number;
}

/**
 * 规则引擎类
 */
export class RuleEngine {
  /**
   * 检查文章是否匹配规则条件
   */
  async matchRule(
    entryId: string,
    rule: SubscriptionRule
  ): Promise<boolean> {
    // 获取文章详情
    const entry = await db.entry.findUnique({
      where: { id: entryId },
      include: {
        feed: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!entry) {
      return false;
    }

    // 检查所有条件，必须全部匹配（AND 逻辑）
    for (const condition of rule.conditions) {
      const isMatch = await this.matchCondition(entry, condition);
      if (!isMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * 匹配单个条件
   */
  private async matchCondition(
    entry: any,
    condition: RuleCondition
  ): Promise<boolean> {
    let fieldValue: string | string[] = '';

    // 获取字段值
    switch (condition.field) {
      case 'title':
        fieldValue = entry.title || '';
        break;
      case 'content':
        fieldValue = entry.content || entry.summary || '';
        break;
      case 'author':
        fieldValue = entry.author || '';
        break;
      case 'category':
        fieldValue = entry.feed?.category?.name || '';
        break;
      case 'tag':
        fieldValue = entry.tags || [];
        break;
      case 'feedTitle':
        fieldValue = entry.feed?.title || '';
        break;
    }

    // 根据操作符进行比较
    switch (condition.operator) {
      case 'contains':
        return typeof fieldValue === 'string'
          ? fieldValue.toLowerCase().includes(String(condition.value).toLowerCase())
          : false;
      case 'notContains':
        return typeof fieldValue === 'string'
          ? !fieldValue.toLowerCase().includes(String(condition.value).toLowerCase())
          : false;
      case 'equals':
        return fieldValue === condition.value;
      case 'notEquals':
        return fieldValue !== condition.value;
      case 'matches':
        const regex = new RegExp(String(condition.value), 'i');
        return typeof fieldValue === 'string' && regex.test(fieldValue);
      case 'in':
        if (!Array.isArray(condition.value)) return false;
        const valueArray = condition.value as string[];
        if (typeof fieldValue === 'string') {
          return valueArray.some(v => typeof v === 'string' && v === fieldValue);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v =>
            typeof v === 'string' && valueArray.some(cv => typeof cv === 'string' && cv === v)
          );
        }
        return false;
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value);
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * 执行规则动作
   */
  async executeActions(
    entryId: string,
    actions: RuleAction[]
  ): Promise<void> {
    for (const action of actions) {
      await this.executeAction(entryId, action);
    }
  }

  /**
   * 执行单个动作
   */
  private async executeAction(entryId: string, action: RuleAction): Promise<void> {
    switch (action.type) {
      case 'markRead':
        await db.entry.update({
          where: { id: entryId },
          data: { isRead: true, readAt: new Date() },
        });
        break;

      case 'markUnread':
        await db.entry.update({
          where: { id: entryId },
          data: { isRead: false, readAt: null },
        });
        break;

      case 'star':
        await db.entry.update({
          where: { id: entryId },
          data: { isStarred: true },
        });
        break;

      case 'unstar':
        await db.entry.update({
          where: { id: entryId },
          data: { isStarred: false },
        });
        break;

      case 'archive':
        await db.entry.update({
          where: { id: entryId },
          data: { isArchived: true },
        });
        break;

      case 'unarchive':
        await db.entry.update({
          where: { id: entryId },
          data: { isArchived: false },
        });
        break;

      case 'assignCategory':
        if (action.params?.categoryId) {
          // 需要先获取 entry 的 feed
          const entry = await db.entry.findUnique({
            where: { id: entryId },
            select: { feedId: true },
          });

          if (entry) {
            await db.entry.update({
              where: { id: entryId },
              data: {} as any,
            });
            // 更新 feed 的分类
            await db.feed.update({
              where: { id: entry.feedId },
              data: { categoryId: action.params.categoryId },
            });
          }
        }
        break;

      case 'addTag':
        if (action.params?.tag && typeof action.params.tag === 'string') {
          const entry = await db.entry.findUnique({
            where: { id: entryId },
            select: { tags: true },
          });

          if (entry) {
            const tags = entry.tags || [];
            if (!tags.includes(action.params.tag)) {
              await db.entry.update({
                where: { id: entryId },
                data: { tags: [...tags, action.params.tag] },
              });
            }
          }
        }
        break;

      case 'removeTag':
        if (action.params?.tag && typeof action.params.tag === 'string') {
          const tagToRemove = action.params.tag;
          const entry = await db.entry.findUnique({
            where: { id: entryId },
            select: { tags: true },
          });

          if (entry && entry.tags) {
            await db.entry.update({
              where: { id: entryId },
              data: { tags: entry.tags.filter((t: string) => t !== tagToRemove) },
            });
          }
        }
        break;

      case 'skip':
        // 跳过处理，不做任何操作
        break;
    }
  }

  /**
   * 处理新文章，应用所有启用的规则
   */
  async processEntry(entryId: string): Promise<{
    matched: string[];
    actions: number;
  }> {
    // 获取所有启用的规则
    const rules = await db.subscriptionRule.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const matchedRules: string[] = [];
    let totalActions = 0;

    for (const rule of rules) {
      const isMatch = await this.matchRule(entryId, rule as unknown as SubscriptionRule);

      if (isMatch) {
        matchedRules.push(rule.name);

        // 更新匹配计数
        await db.subscriptionRule.update({
          where: { id: rule.id },
          data: {
            matchedCount: { increment: 1 },
            lastMatchedAt: new Date(),
          },
        });

        // 执行动作
        await this.executeActions(entryId, rule.actions as unknown as RuleAction[]);
        totalActions += (rule.actions as unknown as RuleAction[]).length;
      }
    }

    return {
      matched: matchedRules,
      actions: totalActions,
    };
  }

  /**
   * 测试规则条件
   */
  async testRule(
    userId: string,
    rule: { conditions: RuleCondition[]; actions: RuleAction[] }
  ): Promise<{
    success: boolean;
    testResult: {
      condition: RuleCondition;
      matchCount: number;
      totalEntries: number;
    }[];
  }> {
    // 获取用户最近的文章用于测试
    const entries = await db.entry.findMany({
      where: {
        feed: { userId },
      },
      take: 100,
      select: {
        id: true,
        title: true,
        content: true,
        summary: true,
        author: true,
        tags: true,
        feed: {
          select: {
            title: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const testResult = rule.conditions.map((condition) => {
      let matchCount = 0;

      for (const entry of entries) {
        if (this.matchConditionSync(entry, condition)) {
          matchCount++;
        }
      }

      return {
        condition,
        matchCount,
        totalEntries: entries.length,
      };
    });

    return {
      success: true,
      testResult,
    };
  }

  /**
   * 同步版本的条件匹配（用于测试）
   */
  private matchConditionSync(entry: any, condition: RuleCondition): boolean {
    let fieldValue: string | string[] = '';

    switch (condition.field) {
      case 'title':
        fieldValue = entry.title || '';
        break;
      case 'content':
        fieldValue = entry.content || entry.summary || '';
        break;
      case 'author':
        fieldValue = entry.author || '';
        break;
      case 'category':
        fieldValue = entry.feed?.category?.name || '';
        break;
      case 'tag':
        fieldValue = entry.tags || [];
        break;
      case 'feedTitle':
        fieldValue = entry.feed?.title || '';
        break;
    }

    switch (condition.operator) {
      case 'contains':
        return typeof fieldValue === 'string'
          ? fieldValue.toLowerCase().includes(String(condition.value).toLowerCase())
          : false;
      case 'notContains':
        return typeof fieldValue === 'string'
          ? !fieldValue.toLowerCase().includes(String(condition.value).toLowerCase())
          : false;
      case 'equals':
        return fieldValue === condition.value;
      case 'notEquals':
        return fieldValue !== condition.value;
      case 'matches':
        const regex = new RegExp(String(condition.value), 'i');
        return typeof fieldValue === 'string' && regex.test(fieldValue);
      case 'in':
        if (!Array.isArray(condition.value)) return false;
        const valueArray = condition.value as string[];
        if (typeof fieldValue === 'string') {
          return valueArray.some(v => typeof v === 'string' && v === fieldValue);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v =>
            typeof v === 'string' && valueArray.some(cv => typeof cv === 'string' && cv === v)
          );
        }
        return false;
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value);
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value);
      default:
        return false;
    }
  }
}

// 单例导出
let ruleEngineInstance: RuleEngine | null = null;

export function getRuleEngine(): RuleEngine {
  if (!ruleEngineInstance) {
    ruleEngineInstance = new RuleEngine();
  }
  return ruleEngineInstance;
}
