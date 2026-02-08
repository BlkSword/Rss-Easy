/**
 * AI 分析引擎 - 类型定义
 */

// =====================================================
// 分段分析
// =====================================================

export interface Segment {
  id: number;
  content: string;
  startIndex: number;
  endIndex: number;
  type: 'text' | 'code' | 'quote' | 'heading';
  metadata?: {
    language?: string;  // 代码块语言
    level?: number;     // 标题级别
  };
}

export interface SegmentAnalysis {
  segmentId: number;
  keyPoints: string[];
  technicalDetails?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  importance: number; // 0-1
  entities?: string[]; // 实体识别
}

// =====================================================
// 文章分析结果
// =====================================================

export interface MainPoint {
  point: string;
  explanation: string;
  importance: number; // 0-1
}

export interface KeyQuote {
  quote: string;
  significance: string;
}

export interface ScoreDimensions {
  depth: number;        // 内容深度 1-10
  quality: number;      // 写作质量 1-10
  practicality: number; // 实用性 1-10
  novelty: number;      // 新颖性 1-10
}

export interface ArticleAnalysisResult {
  // 基础分析
  oneLineSummary: string;
  summary: string;
  mainPoints: MainPoint[];
  keyQuotes?: KeyQuote[];

  // 分类
  domain: string;
  subcategory: string;
  tags: string[];

  // 评分
  aiScore: number; // 1-10
  scoreDimensions: ScoreDimensions;

  // 元数据
  analysisModel: string;
  processingTime: number;
  reflectionRounds: number;
}

// =====================================================
// 反思结果
// =====================================================

export interface ReflectionResult {
  quality: number; // 0-10
  issues: string[];
  suggestions: string[];
  needsRefinement: boolean;
  scores?: {
    comprehensiveness: number; // 全面性
    accuracy: number;          // 准确性
    depth: number;             // 深度性
    consistency: number;       // 一致性
    objectivity: number;       // 客观性
  };
}

// =====================================================
// 分析配置
// =====================================================

export interface AnalysisConfig {
  // 分段配置
  segmentSize?: number;
  segmentOverlap?: number;

  // 反思配置
  enableReflection?: boolean;
  maxReflectionRounds?: number;
  qualityThreshold?: number; // 低于此分数触发反思

  // 模型配置
  analysisModel?: string;
  reflectionModel?: string;
  embeddingModel?: string;
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  segmentSize: 3000,
  segmentOverlap: 200,
  enableReflection: true,
  maxReflectionRounds: 2,
  qualityThreshold: 7,
  analysisModel: 'deepseek-chat',
  reflectionModel: 'gpt-4o',
  embeddingModel: 'text-embedding-3-small',
};
