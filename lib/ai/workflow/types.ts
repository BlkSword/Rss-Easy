/**
 * AI 工作流编排引擎 - 类型定义
 */

import type { AIProvider } from '../client';

// =====================================================
// 工作流上下文
// =====================================================

export interface WorkflowContext {
  entryId: string;
  userId?: string;
  metadata: {
    title: string;
    author?: string;
    feedName: string;
    feedUrl?: string;
    publishedAt?: Date;
  };
  content: string;
  llm: AIProvider;
  vectorStore?: VectorStore;
  userPrefs?: UserPreferenceProfile;
}

// =====================================================
// 工作流节点
// =====================================================

export interface WorkflowNode<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description?: string;
  execute(input: TInput, ctx: WorkflowContext): Promise<TOutput>;
  onError?(error: Error, input: TInput, ctx: WorkflowContext): Promise<TOutput | null>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: (output: any) => boolean; // 条件边
}

// =====================================================
// 工作流配置
// =====================================================

export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  entryNode: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  options?: {
    maxRetries?: number;
    timeout?: number;
    parallelNodes?: string[]; // 可并行执行的节点
  };
}

// =====================================================
// 向量存储接口
// =====================================================

export interface VectorStore {
  // 存储向量
  store(entryId: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
  // 搜索相似向量
  search(vector: number[], limit: number, threshold?: number): Promise<Array<{
    entryId: string;
    similarity: number;
    metadata?: Record<string, any>;
  }>>;
  // 获取向量
  get(entryId: string): Promise<number[] | null>;
}

// =====================================================
// 用户偏好画像
// =====================================================

export interface UserPreferenceProfile {
  userId: string;
  topicWeights: Record<string, number>; // {"Rust": 0.8, "AI": 0.9}
  preferredDepth: 'deep' | 'medium' | 'light';
  preferredLength: 'short' | 'medium' | 'long';
  excludedTags: string[];

  // 统计特征
  avgDwellTime: number;
  completionRate: number;
  diversityScore: number;

  updatedAt: Date;
}

// =====================================================
// 工作流执行结果
// =====================================================

export interface WorkflowResult {
  success: boolean;
  output?: any;
  error?: Error;
  executionTime: number;
  nodeResults: Map<string, any>;
  metadata: {
    workflowId: string;
    executedAt: Date;
    retries: number;
  };
}
