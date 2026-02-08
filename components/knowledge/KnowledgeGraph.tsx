'use client';

/**
 * 知识图谱可视化组件
 *
 * 显示文章之间的语义关系网络
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/trpc/react';
import { Network, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface KnowledgeGraphProps {
  entryId: string;
  depth?: number;
}

export function KnowledgeGraph({ entryId, depth = 2 }: KnowledgeGraphProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const { data, isLoading, refetch } = api.recommendations.getKnowledgeGraph.useQuery({
    entryId,
    depth,
  });

  // 处理拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 缩放控制
  const handleZoomIn = () => {
    setScale(prev => Math.min(2, prev + 0.2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.2));
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          暂无相关文章数据
        </div>
      </Card>
    );
  }

  // 计算节点位置（力导向布局的简化版本）
  const nodePositions = calculateNodePositions(data.nodes, data.edges);

  // 获取边的关系类型颜色
  const getEdgeColor = (label: string) => {
    switch (label) {
      case 'similar': return '#3b82f6'; // blue
      case 'prerequisite': return '#10b981'; // green
      case 'extension': return '#8b5cf6'; // purple
      case 'contradiction': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  return (
    <Card className="p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Network className="h-5 w-5" />
            知识图谱
          </h3>
          {data.stats && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.stats.filteredNodes} 个节点，{data.stats.filteredEdges} 条关系
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 图谱画布 */}
      <div className="border rounded-lg overflow-hidden bg-muted/30">
        <svg
          ref={svgRef}
          className="w-full cursor-grab"
          style={{ height: '400px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
            {/* 绘制边 */}
            {data.edges.map((edge, i) => {
              const source = nodePositions.get(edge.source);
              const target = nodePositions.get(edge.target);

              if (!source || !target) return null;

              return (
                <g key={i}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={getEdgeColor(edge.label)}
                    strokeWidth={2 * edge.strength}
                    opacity={0.6}
                  />
                  {/* 边标签 */}
                  <text
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#6b7280"
                    className="pointer-events-none select-none"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* 绘制节点 */}
            {data.nodes.map((node, i) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isCenter = node.layer === 0;

              return (
                <g key={i}>
                  {/* 节点圆圈 */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isCenter ? 30 : 25}
                    fill={isCenter ? '#3b82f6' : '#8b5cf6'}
                    opacity={0.9}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                  />

                  {/* 节点标签 */}
                  <text
                    x={pos.x}
                    y={pos.y + (isCenter ? 45 : 40)}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#374151"
                    className="pointer-events-none select-none max-w-[100px]"
                  >
                    {truncateText(node.title, 20)}
                  </text>

                  {/* 层级标签 */}
                  {node.layer > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs absolute -translate-x-1/2"
                      style={{ transform: `translate(${pos.x}px, ${pos.y - 40}px)` }}
                    >
                      L{node.layer}
                    </Badge>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap gap-3 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>相似</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>前置知识</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>扩展阅读</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>观点相反</span>
        </div>
      </div>
    </Card>
  );
}

/**
 * 计算节点位置
 *
 * 使用简化的力导向布局算法
 */
function calculateNodePositions(
  nodes: Array<{ id: string; layer: number }>,
  edges: Array<{ source: string; target: string }>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const layerGroups = new Map<number, string[]>();

  // 按层级分组
  for (const node of nodes) {
    if (!layerGroups.has(node.layer)) {
      layerGroups.set(node.layer, []);
    }
    layerGroups.get(node.layer)!.push(node.id);
  }

  // 计算每层的位置
  const width = 800;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;

  for (const [layer, nodeIds] of layerGroups) {
    const layerX = centerX + (layer - 1) * 250;
    const nodeCount = nodeIds.length;
    const radius = Math.min(100, nodeCount * 30);

    for (let i = 0; i < nodeIds.length; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const x = layerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      positions.set(nodeIds[i], { x, y });
    }
  }

  return positions;
}

/**
 * 截断文本
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
