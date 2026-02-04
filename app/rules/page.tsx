/**
 * 订阅规则管理页面
 */

'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  ToggleLeft,
  Play,
  Zap,
  Filter,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

type RuleCondition = {
  field: 'title' | 'content' | 'author' | 'category' | 'tag' | 'feedTitle';
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'matches' | 'in' | 'gt' | 'lt';
  value: string | string[] | number;
};

type RuleAction = {
  type: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'assignCategory' | 'addTag' | 'removeTag' | 'skip';
  params?: Record<string, any>;
};

type Rule = {
  id: string;
  name: string;
  isEnabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  matchedCount: number;
  lastMatchedAt: Date | null;
};

export default function RulesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const { data: rules, isLoading } = trpc.rules.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const addMutation = trpc.rules.add.useMutation();
  const updateMutation = trpc.rules.update.useMutation();
  const deleteMutation = trpc.rules.delete.useMutation();
  const toggleMutation = trpc.rules.toggle.useMutation();
  const testMutation = trpc.rules.test.useMutation();

  const [formState, setFormState] = useState({
    name: '',
    conditions: [] as RuleCondition[],
    actions: [] as RuleAction[],
  });

  const handleAdd = () => {
    setEditingRule(null);
    setFormState({ name: '', conditions: [], actions: [] });
    setShowForm(true);
    setTestResult(null);
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormState({
      name: rule.name,
      conditions: rule.conditions,
      actions: rule.actions,
    });
    setShowForm(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          ...formState,
        });
      } else {
        await addMutation.mutateAsync(formState);
      }
      setShowForm(false);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此规则吗？')) return;
    try {
      await deleteMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '切换失败');
    }
  };

  const handleTest = async () => {
    if (formState.conditions.length === 0) {
      alert('请先添加条件');
      return;
    }

    try {
      const result = await testMutation.mutateAsync({
        conditions: formState.conditions,
        actions: formState.actions,
      });
      setTestResult(result);
    } catch (error) {
      alert(error instanceof Error ? error.message : '测试失败');
    }
  };

  const addCondition = () => {
    setFormState({
      ...formState,
      conditions: [
        ...formState.conditions,
        {
          field: 'title',
          operator: 'contains',
          value: '',
        },
      ],
    });
  };

  const removeCondition = (index: number) => {
    setFormState({
      ...formState,
      conditions: formState.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setFormState({
      ...formState,
      conditions: formState.conditions.map((c, i) =>
        i === index ? { ...c, ...updates } : c
      ),
    });
  };

  const addAction = () => {
    setFormState({
      ...formState,
      actions: [
        ...formState.actions,
        { type: 'skip' },
      ],
    });
  };

  const removeAction = (index: number) => {
    setFormState({
      ...formState,
      actions: formState.actions.filter((_, i) => i !== index),
    });
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setFormState({
      ...formState,
      actions: formState.actions.map((a, i) =>
        i === index ? { ...a, ...updates } : a
      ),
    });
  };

  const getConditionLabel = (condition: RuleCondition) => {
    const fieldLabels = {
      title: '标题',
      content: '内容',
      author: '作者',
      category: '分类',
      tag: '标签',
      feedTitle: '订阅源',
    };

    const operatorLabels = {
      contains: '包含',
      notContains: '不包含',
      equals: '等于',
      notEquals: '不等于',
      matches: '匹配正则',
      in: '在列表中',
      gt: '大于',
      lt: '小于',
    };

    const value = Array.isArray(condition.value)
      ? condition.value.join(', ')
      : String(condition.value);

    return `${fieldLabels[condition.field]} ${operatorLabels[condition.operator]} "${value}"`;
  };

  const getActionLabel = (action: RuleAction) => {
    const labels = {
      markRead: '标记为已读',
      markUnread: '标记为未读',
      star: '加星标',
      unstar: '取消星标',
      archive: '归档',
      unarchive: '取消归档',
      assignCategory: '分配到分类',
      addTag: '添加标签',
      removeTag: '移除标签',
      skip: '跳过',
    };

    let label = labels[action.type];
    if (action.type === 'assignCategory') {
      const cat = categories?.find((c) => c.id === action.params?.categoryId);
      label = `分类: ${cat?.name || action.params?.categoryId}`;
    }
    if (action.type === 'addTag' || action.type === 'removeTag') {
      label = `${label} "${action.params?.tag}"`;
    }

    return label;
  };

  if (showForm) {
    return (
      <div className="container py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {editingRule ? '编辑规则' : '新建规则'}
          </h1>
          <button
            onClick={() => setShowForm(false)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* 规则名称 */}
          <div>
            <label className="block text-sm font-medium mb-2">规则名称</label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="例如：自动归档旧文章"
              className="w-full px-4 py-2 bg-card border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 条件列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">匹配条件（AND）</label>
              <button
                onClick={addCondition}
                className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加条件
              </button>
            </div>
            {formState.conditions.map((condition, index) => (
              <div key={index} className="p-4 bg-card border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid grid-cols-3 gap-3 flex-1">
                    <div>
                      <label className="block text-xs font-medium mb-1">字段</label>
                      <select
                        value={condition.field}
                        onChange={(e) =>
                          updateCondition(index, { field: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-secondary rounded-md text-sm"
                      >
                        <option value="title">标题</option>
                        <option value="content">内容</option>
                        <option value="author">作者</option>
                        <option value="category">分类</option>
                        <option value="tag">标签</option>
                        <option value="feedTitle">订阅源</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">操作</label>
                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(index, { operator: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-secondary rounded-md text-sm"
                      >
                        <option value="contains">包含</option>
                        <option value="notContains">不包含</option>
                        <option value="equals">等于</option>
                        <option value="notEquals">不等于</option>
                        <option value="matches">正则匹配</option>
                        <option value="in">在列表中</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">值</label>
                      {condition.operator === 'in' ? (
                        <input
                          type="text"
                          value={Array.isArray(condition.value) ? condition.value.join(', ') : ''}
                          onChange={(e) =>
                            updateCondition(index, { value: e.target.value.split(',').map(s => s.trim()) })
                          }
                          placeholder="值1, 值2"
                          className="w-full px-3 py-2 bg-secondary rounded-md text-sm"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(condition.value)}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          placeholder="输入值"
                          className="w-full px-3 py-2 bg-secondary rounded-md text-sm"
                        />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCondition(index)}
                    className="p-1 hover:bg-red-500/10 text-red-600 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  匹配: {getConditionLabel(condition)}
                </div>
              </div>
            ))}
            {formState.conditions.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                点击"添加条件"开始创建规则
              </div>
            )}
          </div>

          {/* 动作列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">执行动作</label>
              <button
                onClick={addAction}
                className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加动作
              </button>
            </div>
            {formState.actions.map((action, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                <div className="flex-1">
                  <select
                    value={action.type}
                    onChange={(e) =>
                      updateAction(index, { type: e.target.value as any })
                    }
                    className="px-3 py-2 bg-secondary rounded-md text-sm"
                  >
                    <option value="skip">跳过</option>
                    <option value="markRead">标记已读</option>
                    <option value="markUnread">标记未读</option>
                    <option value="star">加星标</option>
                    <option value="unstar">取消星标</option>
                    <option value="archive">归档</option>
                    <option value="unarchive">取消归档</option>
                    <option value="assignCategory">分配分类</option>
                    <option value="addTag">添加标签</option>
                    <option value="removeTag">移除标签</option>
                  </select>
                </div>
                {(action.type === 'assignCategory' ||
                  action.type === 'addTag' ||
                  action.type === 'removeTag') && (
                  <input
                    type="text"
                    value={
                      action.type === 'assignCategory'
                        ? action.params?.categoryId || ''
                        : action.params?.tag || ''
                    }
                    onChange={(e) =>
                      updateAction(index, {
                        params: { ...action.params, [action.type === 'assignCategory' ? 'categoryId' : 'tag']: e.target.value },
                      })
                    }
                    placeholder={action.type === 'assignCategory' ? '选择分类' : '输入标签'}
                    className="px-3 py-2 bg-secondary rounded-md text-sm"
                  />
                )}
                <button
                  onClick={() => removeAction(index)}
                  className="p-1 hover:bg-red-500/10 text-red-600 rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {formState.actions.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                点击"添加动作"定义规则行为
              </div>
            )}
          </div>

          {/* 测试和保存 */}
          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={handleTest}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              <Play className="h-4 w-4" />
              测试规则
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                保存规则
              </button>
            </div>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-medium mb-3">测试结果</h4>
              <div className="space-y-2">
                {testResult.testResult.map((result: any, index: number) => (
                  <div key={index} className="text-sm">
                    <span className="font-mono">{result.condition.field}.{result.condition.operator}(&quot;{result.condition.value}&quot;)</span>
                    : 匹配 {result.matchCount} / {result.totalEntries} 篇文章
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">订阅规则</h1>
          <p className="text-muted-foreground">
            自动处理匹配条件的文章，无需手动操作
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          新建规则
        </button>
      </div>

      {/* 规则列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !rules || rules.length === 0 ? (
        <div className="text-center py-12">
          <Zap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无规则</h3>
          <p className="text-muted-foreground mb-6">
            创建规则来自动处理您的文章
          </p>
          <button
            onClick={handleAdd}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            创建第一个规则
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <div
              key={rule.id}
              className={cn(
                'bg-card border rounded-lg p-4 transition-colors',
                !rule.isEnabled && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{rule.name}</h3>
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className={cn(
                        'p-1 rounded-md transition-colors',
                        rule.isEnabled ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10'
                      )}
                    >
                      <ToggleLeft className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 条件 */}
                  <div className="space-y-1 mb-3">
                    <div className="text-xs text-muted-foreground">匹配条件:</div>
                    <div className="flex flex-wrap gap-2">
                      {rule.conditions.map((condition: RuleCondition, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-secondary rounded-md text-xs"
                        >
                          {getConditionLabel(condition)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 动作 */}
                  <div className="space-y-1 mb-3">
                    <div className="text-xs text-muted-foreground">执行动作:</div>
                    <div className="flex flex-wrap gap-2">
                      {rule.actions.map((action: RuleAction, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded-full text-xs"
                        >
                          {getActionLabel(action)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 统计 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>匹配 {rule.matchedCount} 次</span>
                    {rule.lastMatchedAt && (
                      <span>
                        最后匹配{' '}
                        {new Date(rule.lastMatchedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-2 hover:bg-secondary rounded-md transition-colors"
                    title="编辑"
                  >
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-600 rounded-md transition-colors"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
