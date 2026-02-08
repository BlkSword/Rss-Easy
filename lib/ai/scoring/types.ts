/**
 * 个性化评分系统 - 类型定义
 */

// =====================================================
// 评分维度
// =====================================================

export interface ScoringDimensions {
  depth: number;        // 内容深度 1-10
  quality: number;      // 写作质量 1-10
  practicality: number; // 实用性 1-10
  novelty: number;      // 新颖性 1-10
  relevance: number;    // 个人相关度 1-10
}

// =====================================================
// 个性化评分结果
// =====================================================

export type RecommendedAction = 'read_now' | 'read_later' | 'archive' | 'skip';

export interface PersonalizedScore {
  overall: number;           // 总分 1-10
  dimensions: ScoringDimensions;
  reasons: string[];         // 评分理由
  recommendedAction: RecommendedAction;
  confidence: number;        // 评分置信度 0-1
  boostFactors?: {           // 增强因子（调试用）
    depthBoost: number;
    practicalityBoost: number;
    noveltyFactor: number;
    relevanceBoost: number;
  };
}

// =====================================================
// 用户阅读行为
// =====================================================

export interface ReadingBehavior {
  userId: string;
  entryId: string;
  startedAt: Date;
  endedAt?: Date;
  dwellTime: number;         // 停留秒数
  scrollDepth: number;       // 滚动深度 0-1
  isCompleted: boolean;      // 是否阅读完成
  isStarred: boolean;
  rating?: number;           // 用户主动评分 1-5
}

export interface AggregatedBehavior {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };

  // 统计指标
  totalEntries: number;
  totalReadTime: number;     // 总阅读时间（秒）
  avgDwellTime: number;      // 平均停留时间
  completionRate: number;    // 完成率
  starRate: number;          // 收藏率

  // 偏好分析
  depthPreference: 'deep' | 'medium' | 'light';
  preferredCategories: string[]; // 偏好分类
  preferredTags: Record<string, number>; // 偏好标签权重
  excludedTags: string[];    // 排除标签

  // 多样性
  diversityScore: number;    // 阅读多样性 0-1
}

// =====================================================
// 用户偏好画像
// =====================================================

export interface UserPreferenceProfile {
  userId: string;

  // 主题权重
  topicWeights: Record<string, number>; // {"Rust": 0.8, "AI": 0.9}

  // 阅读偏好
  preferredDepth: 'deep' | 'medium' | 'light';
  preferredLength: 'short' | 'medium' | 'long';

  // 负反馈
  excludedTags: string[];

  // 统计特征
  avgDwellTime: number;
  completionRate: number;
  diversityScore: number;

  // 兴趣向量（用于快速匹配）
  interestVector?: number[];

  updatedAt: Date;
}

// =====================================================
// 推荐配置
// =====================================================

export interface RecommendationConfig {
  // 推荐策略权重
  weights: {
    contentQuality: number;  // 内容质量权重
    personalRelevance: number; // 个人相关性权重
    novelty: number;         // 新颖性权重
    recency: number;         // 时间新鲜度权重
  };

  // 过滤条件
  filters: {
    minScore: number;        // 最低评分
    minRelevance: number;    // 最低相关度
    maxSimilarity: number;   // 最大相似度（去重）
    excludeRead: boolean;    // 排除已读
    excludeTags: string[];   // 排除标签
  };

  // 多样性控制
  diversity: {
    enabled: boolean;
    minCategorySpread: number; // 最少分类数
    maxSameCategory: number;   // 同类文章上限
  };
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  weights: {
    contentQuality: 0.3,
    personalRelevance: 0.4,
    novelty: 0.2,
    recency: 0.1,
  },
  filters: {
    minScore: 5,
    minRelevance: 3,
    maxSimilarity: 0.9,
    excludeRead: false,
    excludeTags: [],
  },
  diversity: {
    enabled: true,
    minCategorySpread: 3,
    maxSameCategory: 5,
  },
};
