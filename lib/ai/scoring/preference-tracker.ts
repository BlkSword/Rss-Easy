/**
 * 用户偏好自动学习算法
 *
 * 基于用户阅读行为自动学习和更新用户偏好画像
 */

import { db } from '@/lib/db';
import type { UserPreferenceProfile } from '@/lib/ai/scoring/types';

/**
 * 更新用户偏好（异步）
 *
 * 根据用户最近的阅读行为自动更新偏好画像
 */
export async function updateUserPreferences(userId: string): Promise<void> {
  try {
    // 1. 获取最近的阅读行为
    const recentSessions = await getRecentReadingSessions(userId, 30); // 最近30天

    if (recentSessions.length === 0) {
      return; // 没有行为数据，跳过
    }

    // 2. 分析主题权重
    const topicWeights = await analyzeTopicWeights(recentSessions);

    // 3. 分析阅读偏好
    const readingPreferences = analyzeReadingPreferences(recentSessions);

    // 4. 分析负反馈标签
    const excludedTags = analyzeExcludedTags(recentSessions);

    // 5. 计算统计数据
    const stats = calculateStatistics(recentSessions);

    // 6. 更新或创建用户偏好
    await db.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        topicWeights,
        preferredDepth: readingPreferences.depth,
        preferredLength: readingPreferences.length,
        excludedTags,
        ...stats,
      },
      update: {
        topicWeights,
        preferredDepth: readingPreferences.depth,
        preferredLength: readingPreferences.length,
        excludedTags,
        ...stats,
      },
    });
  } catch (error) {
    console.error('更新用户偏好失败:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 获取最近的阅读会话
 */
async function getRecentReadingSessions(userId: string, days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return db.readingSession.findMany({
    where: {
      userId,
      startedAt: { gte: startDate },
    },
    include: {
      entry: {
        select: {
          tags: true,
          aiCategory: true,
          aiKeywords: true,
          feed: {
            select: {
              tags: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });
}

/**
 * 分析主题权重
 *
 * 基于用户阅读的标签和类别计算主题兴趣度
 */
async function analyzeTopicWeights(sessions: any[]): Promise<Record<string, number>> {
  const tagScores: Record<string, number> = {};

  for (const session of sessions) {
    const entry = session.entry;

    // 跳过未完成的阅读
    if (!session.isCompleted && session.dwellTime < 30) {
      continue;
    }

    // 收集所有标签
    const tags = [
      ...(entry.tags || []),
      ...(entry.feed?.tags || []),
      ...(entry.aiKeywords || []),
      entry.aiCategory,
    ].filter(Boolean);

    // 根据阅读行为计算标签得分
    const score = calculateReadingScore(session);

    for (const tag of tags) {
      const tagKey = tag.toLowerCase();
      tagScores[tagKey] = (tagScores[tagKey] || 0) + score;
    }
  }

  // 归一化到 0-1 范围
  const maxScore = Math.max(...Object.values(tagScores), 1);
  const normalizedWeights: Record<string, number> = {};

  for (const [tag, score] of Object.entries(tagScores)) {
    // 只保留权重 > 0.1 的标签
    if (score / maxScore > 0.1) {
      normalizedWeights[tag] = Math.min(1, score / maxScore);
    }
  }

  return normalizedWeights;
}

/**
 * 计算阅读得分
 *
 * 根据停留时间、滚动深度、完成状态计算综合得分
 */
function calculateReadingScore(session: any): number {
  let score = 0;

  // 停留时间得分 (最多 2 分)
  const dwellScore = Math.min(2, session.dwellTime / 120); // 2分钟 = 2分
  score += dwellScore;

  // 滚动深度得分 (最多 2 分)
  const depthScore = session.scrollDepth * 2;
  score += depthScore;

  // 完成度得分 (最多 2 分)
  if (session.isCompleted) {
    score += 2;
  }

  // 收藏加分 (最多 1 分)
  if (session.isStarred) {
    score += 1;
  }

  // 评分加分 (最多 1 分)
  if (session.rating && session.rating >= 4) {
    score += 1;
  }

  return score;
}

/**
 * 分析阅读偏好
 */
function analyzeReadingPreferences(sessions: any[]): {
  depth: 'deep' | 'medium' | 'light';
  length: 'short' | 'medium' | 'long';
} {
  // 计算平均停留时间
  const avgDwellTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0) / sessions.length;

  // 计算平均完成率
  const completionRate = sessions.filter(s => s.isCompleted).length / sessions.length;

  // 判断深度偏好
  let depth: 'deep' | 'medium' | 'light';
  if (avgDwellTime > 180 && completionRate > 0.6) {
    depth = 'deep';
  } else if (avgDwellTime < 60) {
    depth = 'light';
  } else {
    depth = 'medium';
  }

  // 判断长度偏好（简化实现）
  const length: 'short' | 'medium' | 'long' = 'medium';

  return { depth, length };
}

/**
 * 分析排除标签
 *
 * 识别用户不感兴趣的标签
 */
function analyzeExcludedTags(sessions: any[]): string[] {
  const tagSkipScores: Record<string, number> = {};

  for (const session of sessions) {
    const entry = session.entry;

    // 跳过深度阅读的（说明用户感兴趣）
    if (session.dwellTime > 120 || session.isCompleted) {
      continue;
    }

    // 快速跳过的文章的标签可能不感兴趣
    if (session.dwellTime < 10 && session.scrollDepth < 0.2) {
      const tags = [
        ...(entry.tags || []),
        ...(entry.feed?.tags || []),
      ].filter(Boolean);

      for (const tag of tags) {
        const tagKey = tag.toLowerCase();
        tagSkipScores[tagKey] = (tagSkipScores[tagKey] || 0) + 1;
      }
    }
  }

  // 被快速跳过超过 3 次的标签加入排除列表
  const excludedTags = Object.entries(tagSkipScores)
    .filter(([_, count]) => count >= 3)
    .map(([tag]) => tag);

  return excludedTags;
}

/**
 * 计算统计数据
 */
function calculateStatistics(sessions: any[]) {
  const totalEntries = sessions.length;
  const totalReadTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
  const avgDwellTime = totalEntries > 0 ? totalReadTime / totalEntries : 0;
  const completedCount = sessions.filter(s => s.isCompleted).length;
  const avgCompletion = totalEntries > 0 ? completedCount / totalEntries : 0;

  // 计算阅读多样性
  const uniqueCategories = new Set(
    sessions.map(s => s.entry.aiCategory).filter(Boolean)
  );
  const diversityScore = Math.min(1, uniqueCategories.size / 10);

  return {
    totalReadTime,
    totalEntries,
    avgDwellTime: Math.round(avgDwellTime),
    avgCompletion: Math.round(avgCompletion * 100) / 100,
    diversityScore: Math.round(diversityScore * 100) / 100,
  };
}

/**
 * 获取用户阅读画像
 */
export async function getUserReadingProfile(
  userId: string
): Promise<UserPreferenceProfile> {
  const preference = await db.userPreference.findUnique({
    where: { userId },
  });

  if (!preference) {
    // 返回默认画像
    return {
      userId,
      topicWeights: {},
      preferredDepth: 'medium',
      preferredLength: 'medium',
      excludedTags: [],
      avgDwellTime: 0,
      completionRate: 0,
      diversityScore: 0,
      updatedAt: new Date(),
    };
  }

  return {
    userId: preference.userId,
    topicWeights: preference.topicWeights as Record<string, number>,
    preferredDepth: (preference.preferredDepth || 'medium') as 'deep' | 'medium' | 'light',
    preferredLength: (preference.preferredLength || 'medium') as 'short' | 'medium' | 'long',
    excludedTags: preference.excludedTags,
    avgDwellTime: preference.avgDwellTime,
    completionRate: preference.avgCompletion,
    diversityScore: preference.diversityScore,
    updatedAt: preference.updatedAt,
  };
}

/**
 * 批量更新用户偏好
 */
export async function batchUpdateUserPreferences(userIds: string[]): Promise<void> {
  const promises = userIds.map(userId => updateUserPreferences(userId));
  await Promise.allSettled(promises);
}

/**
 * 定时更新所有用户偏好
 */
export async function scheduleUserPreferenceUpdates(): Promise<void> {
  // 获取所有活跃用户（最近30天有活动的）
  const activeUsers = await db.userPreference.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      userId: true,
    },
  });

  const userIds = activeUsers.map(u => u.userId);
  await batchUpdateUserPreferences(userIds);
}
