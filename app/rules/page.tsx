/**
 * 订阅规则管理页面 - 全屏布局
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
import { Button, Card, Modal, Form, Input, Select, Switch, Space, Tag, Empty, Badge, Tooltip, Divider } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';

type RuleCondition = {
  field: 'title' | 'content' | 'author' | 'category' | 'tag' | 'feedTitle';
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'matches' | 'in' | 'gt' | 'lt';
  value: string | string[] | number;
};

type RuleAction = {
  type: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'assignCategory' | 'addTag' | 'removeTag';
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

  const { data: rules, isLoading, refetch } = trpc.rules.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const addMutation = trpc.rules.add.useMutation();
  const updateMutation = trpc.rules.update.useMutation();
  const deleteMutation = trpc.rules.delete.useMutation();
  const toggleMutation = trpc.rules.toggle.useMutation();
  const testMutation = trpc.rules.test.useMutation();
  const executeMutation = trpc.rules.execute.useMutation();

  const [form] = Form.useForm();

  const fieldOptions = [
    { label: '标题', value: 'title' },
    { label: '内容', value: 'content' },
    { label: '作者', value: 'author' },
    { label: '分类', value: 'category' },
    { label: '标签', value: 'tag' },
    { label: '订阅源', value: 'feedTitle' },
  ];

  const operatorOptions = [
    { label: '包含', value: 'contains' },
    { label: '不包含', value: 'notContains' },
    { label: '等于', value: 'equals' },
    { label: '不等于', value: 'notEquals' },
    { label: '匹配正则', value: 'matches' },
    { label: '在列表中', value: 'in' },
    { label: '大于', value: 'gt' },
    { label: '小于', value: 'lt' },
  ];

  const actionOptions = [
    { label: '标记为已读', value: 'markRead' },
    { label: '标记为未读', value: 'markUnread' },
    { label: '添加星标', value: 'star' },
    { label: '移除星标', value: 'unstar' },
    { label: '归档', value: 'archive' },
    { label: '取消归档', value: 'unarchive' },
    { label: '分配分类', value: 'assignCategory' },
    { label: '添加标签', value: 'addTag' },
    { label: '移除标签', value: 'removeTag' },
  ];

  const handleAdd = () => {
    setEditingRule(null);
    form.resetFields();
    setShowForm(true);
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      conditions: rule.conditions,
      actions: rule.actions,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条规则吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync({ id });
          handleApiSuccess('删除成功');
          refetch();
        } catch (error) {
          handleApiError(error, '删除失败');
        }
      },
    });
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id, enabled });
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          ...values,
        });
        handleApiSuccess('更新成功');
      } else {
        await addMutation.mutateAsync(values);
        handleApiSuccess('创建成功');
      }
      setShowForm(false);
      form.resetFields();
      refetch();
    } catch (error) {
      handleApiError(error, editingRule ? '更新失败' : '创建失败');
    }
  };

  const handleTest = async () => {
    const values = form.getFieldsValue();
    try {
      const result = await testMutation.mutateAsync({
        rule: {
          name: values.name || '测试规则',
          conditions: values.conditions || [],
          actions: values.actions || [],
        },
        sampleCount: 5,
      });
      setTestResult(result);
    } catch (error) {
      handleApiError(error, '测试失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeMutation.mutateAsync({ ruleId: id });
      handleApiSuccess('规则执行成功');
      refetch();
    } catch (error) {
      handleApiError(error, '执行失败');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">订阅规则</h1>
                <p className="text-muted-foreground text-sm">自动处理符合条件的文章</p>
              </div>
              <Button type="primary" icon={<Plus className="h-4 w-4" />} onClick={handleAdd}>
                新建规则
              </Button>
            </div>

            {/* 规则列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">加载中...</p>
                </div>
              </div>
            ) : !rules || rules.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <p>还没有创建任何规则</p>
                    <Button type="primary" icon={<Plus className="h-4 w-4" />} onClick={handleAdd}>
                      新建规则
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <Card
                    key={rule.id}
                    className={cn('border-border/60', !rule.isEnabled && 'opacity-50')}
                    size="small"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Switch
                            size="small"
                            checked={rule.isEnabled}
                            onChange={(e) => handleToggle(rule.id, e)}
                          />
                          <Badge count={rule.matchedCount} showZero />
                        </div>

                        {/* 条件 */}
                        <div className="mb-2">
                          <div className="text-xs text-muted-foreground mb-1">如果</div>
                          <div className="space-y-1">
                            {rule.conditions.map((condition, index) => (
                              <Tag key={index} className="rounded-md">
                                {fieldOptions.find((f) => f.value === condition.field)?.label}
                                {operatorOptions.find((o) => o.value === condition.operator)?.label}
                                "{String(condition.value)}"
                              </Tag>
                            ))}
                          </div>
                        </div>

                        {/* 操作 */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">那么</div>
                          <div className="space-y-1">
                            {rule.actions.map((action, index) => (
                              <Tag key={index} color="primary" className="rounded-md">
                                {actionOptions.find((a) => a.value === action.type)?.label}
                                {action.params ? `: ${JSON.stringify(action.params)}` : ''}
                              </Tag>
                            ))}
                          </div>
                        </div>

                        {rule.lastMatchedAt && (
                          <div className="text-xs text-muted-foreground mt-2">
                            最后匹配: {new Date(rule.lastMatchedAt).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <Space>
                        <Tooltip title="执行规则">
                          <Button
                            type="text"
                            size="small"
                            icon={<Play className="h-4 w-4" />}
                            onClick={() => handleExecute(rule.id)}
                            disabled={!rule.isEnabled}
                          />
                        </Tooltip>
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<Edit className="h-4 w-4" />}
                            onClick={() => handleEdit(rule)}
                          />
                        </Tooltip>
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => handleDelete(rule.id)}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 规则编辑弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={showForm}
        onCancel={() => {
          setShowForm(false);
          setEditingRule(null);
          form.resetFields();
        }}
        width={600}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：科技新闻自动归档" />
          </Form-item>

          <Divider orientation="left">条件</Divider>

          <Form.List name="conditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" className="w-full mb-2" style={{ display: 'flex' }}>
                    <Form.Item
                      {...restField}
                      name={[name, 'field']}
                      rules={[{ required: true }]}
                                            >
                      <Select placeholder="字段" options={fieldOptions} style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'operator']}
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="操作" options={operatorOptions} style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="值" />
                    </Form.Item>
                    <Button type="text" icon={<X className="h-4 w-4" />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<Plus className="h-4 w-4" />} block>
                  添加条件
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left">操作</Divider>

          <Form.List name="actions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" className="w-full mb-2" style={{ display: 'flex' }}>
                    <Form.Item
                      {...restField}
                      name={[name, 'type']}
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="操作类型" options={actionOptions} style={{ width: 180 }} />
                    </Form.Item>
                    <Button type="text" icon={<X className="h-4 w-4" />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<Plus className="h-4 w-4" />} block>
                  添加操作
                </Button>
              </>
            )}
          </Form.List>

          <Divider />

          <Form.Item className="mb-0">
            <Space>
              <Button onClick={() => setShowForm(false)}>取消</Button>
              <Button onClick={handleTest} icon={<Zap className="h-4 w-4" />}>测试</Button>
              <Button type="primary" htmlType="submit">
                {editingRule ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
