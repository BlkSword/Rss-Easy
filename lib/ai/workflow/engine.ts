/**
 * AI 工作流编排引擎
 *
 * 负责协调多个 AI 处理节点，按依赖关系执行工作流
 */

import type {
  WorkflowContext,
  WorkflowNode,
  WorkflowEdge,
  WorkflowResult,
} from './types';

export class WorkflowOrchestrator {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: WorkflowEdge[] = [];

  /**
   * 注册工作流节点
   */
  registerNode(node: WorkflowNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * 批量注册节点
   */
  registerNodes(nodes: WorkflowNode[]): void {
    nodes.forEach(node => this.registerNode(node));
  }

  /**
   * 添加工作流边（依赖关系）
   */
  addEdge(edge: WorkflowEdge): void {
    this.edges.push(edge);
  }

  /**
   * 批量添加边
   */
  addEdges(edges: WorkflowEdge[]): void {
    this.edges.push(...edges);
  }

  /**
   * 构建依赖图
   */
  private buildDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    // 初始化所有节点
    this.nodes.forEach((_, nodeId) => {
      graph.set(nodeId, []);
    });

    // 根据边构建依赖关系
    this.edges.forEach(edge => {
      const deps = graph.get(edge.to) || [];
      deps.push(edge.from);
      graph.set(edge.to, deps);
    });

    return graph;
  }

  /**
   * 获取节点的所有下游节点
   */
  private getDownstreamNodes(nodeId: string): string[] {
    const downstream: string[] = [];
    this.edges.forEach(edge => {
      if (edge.from === nodeId) {
        downstream.push(edge.to);
      }
    });
    return downstream;
  }

  /**
   * 拓扑排序（检测循环依赖）
   */
  private topologicalSort(): string[] {
    const graph = this.buildDependencyGraph();
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // 计算入度
    graph.forEach((deps, nodeId) => {
      inDegree.set(nodeId, deps.length);
      if (deps.length === 0) {
        queue.push(nodeId);
      }
    });

    // 拓扑排序
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const downstream = this.getDownstreamNodes(nodeId);
      downstream.forEach(downstreamId => {
        const currentInDegree = inDegree.get(downstreamId)!;
        inDegree.set(downstreamId, currentInDegree - 1);

        if (inDegree.get(downstreamId) === 0) {
          queue.push(downstreamId);
        }
      });
    }

    // 检测循环依赖
    if (result.length !== this.nodes.size) {
      throw new Error('工作流存在循环依赖');
    }

    return result;
  }

  /**
   * 执行工作流
   */
  async execute(
    entryNodeId: string,
    initialInput: any,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const executedNodes = new Set<string>();
    const nodeResults = new Map<string, any>();
    let retries = 0;

    try {
      // 拓扑排序获取执行顺序
      const sortedNodes = this.topologicalSort();

      // 找到入口节点的位置，从它开始执行
      const entryIndex = sortedNodes.indexOf(entryNodeId);
      const nodesToExecute = sortedNodes.slice(entryIndex);

      // 按顺序执行节点
      for (const nodeId of nodesToExecute) {
        const result = await this.executeNode(nodeId, initialInput, context, nodeResults);
        nodeResults.set(nodeId, result);
        executedNodes.add(nodeId);
      }

      // 返回最后一个节点的结果作为最终输出
      const finalNodeId = nodesToExecute[nodesToExecute.length - 1];
      const finalOutput = nodeResults.get(finalNodeId);

      return {
        success: true,
        output: finalOutput,
        executionTime: Date.now() - startTime,
        nodeResults,
        metadata: {
          workflowId: 'default',
          executedAt: new Date(),
          retries,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
        nodeResults,
        metadata: {
          workflowId: 'default',
          executedAt: new Date(),
          retries,
        },
      };
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    nodeId: string,
    initialInput: any,
    context: WorkflowContext,
    nodeResults: Map<string, any>
  ): Promise<any> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`节点 ${nodeId} 未找到`);
    }

    // 构建输入：合并依赖节点的输出
    const graph = this.buildDependencyGraph();
    const dependencies = graph.get(nodeId) || [];
    const dependencyOutputs = dependencies.map(depId => nodeResults.get(depId));
    const mergedInput = this.mergeInputs([initialInput, ...dependencyOutputs]);

    try {
      return await node.execute(mergedInput, context);
    } catch (error) {
      // 如果有错误处理器，使用它
      if (node.onError) {
        return await node.onError(error as Error, mergedInput, context);
      }
      throw error;
    }
  }

  /**
   * 合并多个输入
   */
  private mergeInputs(inputs: any[]): any {
    return inputs.reduce((acc, curr) => {
      if (curr === null || curr === undefined) return acc;
      if (typeof curr !== 'object') return curr;

      return {
        ...acc,
        ...curr,
      };
    }, {});
  }

  /**
   * 清空工作流
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }

  /**
   * 获取工作流统计信息
   */
  getStats() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      nodeIds: Array.from(this.nodes.keys()),
    };
  }
}

/**
 * 创建预定义的工作流
 */
export function createArticleAnalysisWorkflow(): WorkflowOrchestrator {
  const workflow = new WorkflowOrchestrator();

  // TODO: 注册节点和边
  // workflow.registerNode(segmentNode);
  // workflow.registerNode(analyzeNode);
  // workflow.addEdge({ from: 'segment', to: 'analyze' });

  return workflow;
}
