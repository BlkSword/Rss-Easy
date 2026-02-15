/**
 * 报告定时任务管理组件
 * 支持创建、编辑、删除、启用/禁用定时任务
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Mail,
  CheckCircle,
  Calendar,
  RefreshCw,
  Settings,
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Select,
  Switch,
  DatePicker,
  Space,
  Divider,
  Popconfirm,
  Tooltip,
  Tag,
  Form,
  InputNumber,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { cn } from '@/lib/utils';

// 频次选项
const frequencyOptions = [
  { value: 'once', label: '仅执行一次' },
  { value: 'daily', label: '每天执行' },
  { value: 'weekly', label: '每周执行' },
  { value: 'monthly', label: '每月执行' },
];

// 日期范围选项
const dateRangeOptions = [
  { value: 'yesterday', label: '昨天' },
  { value: 'last7days', label: '最近7天' },
  { value: 'last30days', label: '最近30天' },
  { value: 'lastWeek', label: '上周' },
  { value: 'lastMonth', label: '上月' },
  { value: 'custom', label: '自定义天数' },
];

interface Schedule {
  id: string;
  name: string;
  firstRunAt: Date;
  frequency: string;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  dateRange: string;
  customDays: number | null;
  includeStats: boolean;
  includeHighlights: boolean;
  includeAiSummary: boolean;
  recipientEmail: string;
  emailSubject: string | null;
  isEnabled: boolean;
  runCount: number;
  createdAt: Date;
}

interface ReportScheduleSettingsProps {
  open: boolean;
  onClose: () => void;
}

// 任务卡片
function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onToggle,
  onExecute,
}: {
  schedule: Schedule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onExecute: () => void;
}) {
  const frequencyLabel = frequencyOptions.find(f => f.value === schedule.frequency)?.label || schedule.frequency;
  const dateRangeLabel = schedule.dateRange === 'custom'
    ? `最近 ${schedule.customDays} 天`
    : dateRangeOptions.find(d => d.value === schedule.dateRange)?.label || schedule.dateRange;

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-4 transition-all duration-300',
        schedule.isEnabled
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/60 bg-muted/20 opacity-70'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium truncate">{schedule.name}</h4>
            {schedule.isEnabled ? (
              <Tag color="success" icon={<CheckCircle className="h-3 w-3" />}>
                已启用
              </Tag>
            ) : (
              <Tag color="default" icon={<Pause className="h-3 w-3" />}>
                已暂停
              </Tag>
            )}
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>
                首次执行：{dayjs(schedule.firstRunAt).format('YYYY-MM-DD HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>重复频次：{frequencyLabel}</span>
            </div>
            {schedule.nextRunAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  下次执行：{dayjs(schedule.nextRunAt).format('YYYY-MM-DD HH:mm')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              <span>接收邮箱：{schedule.recipientEmail}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Tag>{dateRangeLabel}</Tag>
            {schedule.includeStats && <Tag color="blue">阅读统计</Tag>}
            {schedule.includeHighlights && <Tag color="gold">精选内容</Tag>}
            {schedule.includeAiSummary && <Tag color="purple">AI 摘要</Tag>}
          </div>

          {schedule.lastRunAt && (
            <p className="text-xs text-muted-foreground mt-2">
              上次执行：{dayjs(schedule.lastRunAt).format('YYYY-MM-DD HH:mm')}
              ({schedule.runCount} 次)
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-4">
          <Tooltip title={schedule.isEnabled ? '暂停' : '启用'}>
            <Button
              type="text"
              size="small"
              icon={schedule.isEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              onClick={onToggle}
            />
          </Tooltip>
          <Tooltip title="立即执行">
            <Button
              type="text"
              size="small"
              icon={<Play className="h-4 w-4" />}
              onClick={onExecute}
              disabled={!schedule.isEnabled}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<Edit className="h-4 w-4" />}
              onClick={onEdit}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此定时任务？"
            onConfirm={onDelete}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="h-4 w-4" />}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

// 任务编辑表单
function ScheduleForm({
  form,
  isEdit,
  userEmail,
}: {
  form: FormInstance;
  isEdit: boolean;
  userEmail?: string;
}) {
  const dateRange = Form.useWatch('dateRange', form);

  useEffect(() => {
    // 设置默认邮箱
    if (!isEdit && userEmail) {
      form.setFieldValue('recipientEmail', userEmail);
    }
  }, [form, isEdit, userEmail]);

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          基本信息
        </h4>
        <Form.Item
          name="name"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如：每周阅读周报" maxLength={100} />
        </Form.Item>
      </div>

      <Divider className="my-3" />

      {/* 执行时间 */}
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          执行时间
        </h4>
        <Form.Item
          name="firstRunAt"
          label="首次执行时间"
          rules={[{ required: true, message: '请选择首次执行时间' }]}
        >
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            style={{ width: '100%' }}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </Form.Item>
        <Form.Item
          name="frequency"
          label="重复频次"
          rules={[{ required: true, message: '请选择重复频次' }]}
          initialValue="weekly"
        >
          <Select options={frequencyOptions} />
        </Form.Item>
      </div>

      <Divider className="my-3" />

      {/* 报告内容 */}
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          报告内容
        </h4>
        <Form.Item
          name="dateRange"
          label="数据范围"
          rules={[{ required: true, message: '请选择数据范围' }]}
          initialValue="lastWeek"
        >
          <Select options={dateRangeOptions} />
        </Form.Item>
        {dateRange === 'custom' && (
          <Form.Item
            name="customDays"
            label="自定义天数"
            rules={[{ required: true, message: '请输入天数' }]}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} placeholder="输入天数" />
          </Form.Item>
        )}
        <Form.Item label="包含内容">
          <Space direction="vertical">
            <Form.Item name="includeStats" valuePropName="checked" noStyle initialValue={true}>
              <Switch checkedChildren="阅读统计" unCheckedChildren="阅读统计" defaultChecked />
            </Form.Item>
            <Form.Item name="includeHighlights" valuePropName="checked" noStyle initialValue={true}>
              <Switch checkedChildren="精选内容" unCheckedChildren="精选内容" defaultChecked />
            </Form.Item>
            <Form.Item name="includeAiSummary" valuePropName="checked" noStyle initialValue={true}>
              <Switch checkedChildren="AI 摘要" unCheckedChildren="AI 摘要" defaultChecked />
            </Form.Item>
          </Space>
        </Form.Item>
      </div>

      <Divider className="my-3" />

      {/* 发送设置 */}
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Mail className="h-4 w-4" />
          发送设置
        </h4>
        <Form.Item
          name="recipientEmail"
          label="接收邮箱"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input placeholder="输入接收报告的邮箱地址" />
        </Form.Item>
        <Form.Item name="emailSubject" label="邮件主题（可选）">
          <Input placeholder="留空使用默认主题" maxLength={200} />
        </Form.Item>
      </div>
    </div>
  );
}

export function ReportScheduleSettings({ open, onClose }: ReportScheduleSettingsProps) {
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // 查询
  const { data: schedules, isLoading, refetch } = trpc.reportSchedules.list.useQuery(undefined, {
    enabled: open,
  });
  const { data: emailConfig } = trpc.reports.checkEmailConfig.useQuery(undefined, {
    enabled: open,
  });
  const { data: aiConfigStatus } = trpc.reports.checkAIConfig.useQuery(undefined, {
    enabled: open,
  });

  // 变更
  const createMutation = trpc.reportSchedules.create.useMutation();
  const updateMutation = trpc.reportSchedules.update.useMutation();
  const deleteMutation = trpc.reportSchedules.delete.useMutation();
  const toggleMutation = trpc.reportSchedules.toggle.useMutation();
  const executeMutation = trpc.reportSchedules.executeNow.useMutation();

  // 配置状态
  const isAIConfigured = aiConfigStatus?.success ?? false;
  const isEmailConfigured = !!(emailConfig?.enabled && emailConfig?.configured);
  const canCreate = isAIConfigured && isEmailConfigured;

  // 打开创建表单
  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setFormOpen(true);
  };

  // 打开编辑表单
  const handleEdit = (schedule: Schedule) => {
    setEditingId(schedule.id);
    form.setFieldsValue({
      name: schedule.name,
      firstRunAt: dayjs(schedule.firstRunAt),
      frequency: schedule.frequency,
      dateRange: schedule.dateRange,
      customDays: schedule.customDays,
      includeStats: schedule.includeStats,
      includeHighlights: schedule.includeHighlights,
      includeAiSummary: schedule.includeAiSummary,
      recipientEmail: schedule.recipientEmail,
      emailSubject: schedule.emailSubject,
    });
    setFormOpen(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const input = {
        ...values,
        firstRunAt: values.firstRunAt.toDate(),
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...input });
        notifySuccess('更新成功', '定时任务已更新');
      } else {
        await createMutation.mutateAsync(input);
        notifySuccess('创建成功', '定时任务已创建');
      }

      setFormOpen(false);
      refetch();
    } catch (err: any) {
      notifyError(err.message || '操作失败');
    }
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      notifySuccess('删除成功');
      refetch();
    } catch (err: any) {
      notifyError(err.message || '删除失败');
    }
  };

  // 启用/禁用
  const handleToggle = async (schedule: Schedule) => {
    try {
      await toggleMutation.mutateAsync({
        id: schedule.id,
        isEnabled: !schedule.isEnabled,
      });
      notifySuccess(schedule.isEnabled ? '已暂停' : '已启用');
      refetch();
    } catch (err: any) {
      notifyError(err.message || '操作失败');
    }
  };

  // 立即执行
  const handleExecute = async (id: string) => {
    try {
      await executeMutation.mutateAsync({ id });
      notifySuccess('任务已触发', '报告正在生成中...');
      refetch();
    } catch (err: any) {
      notifyError(err.message || '执行失败');
    }
  };

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <span>定时任务</span>
          </div>
        }
        open={open}
        onCancel={onClose}
        footer={null}
        width={700}
      >
        <div className="space-y-4">
          {/* 创建按钮 */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {schedules?.length || 0} 个定时任务
            </span>
            <Button
              type="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleCreate}
              disabled={!canCreate}
            >
              创建定时任务
            </Button>
          </div>

          {/* 任务列表 */}
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <div className="animate-pulse">加载中...</div>
            </div>
          ) : !schedules || schedules.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>暂无定时任务</p>
              <p className="text-sm mt-1">点击上方按钮创建定时任务</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule as Schedule}
                  onEdit={() => handleEdit(schedule as Schedule)}
                  onDelete={() => handleDelete(schedule.id)}
                  onToggle={() => handleToggle(schedule as Schedule)}
                  onExecute={() => handleExecute(schedule.id)}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 创建/编辑表单弹窗 */}
      <Modal
        title={editingId ? '编辑定时任务' : '创建定时任务'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setFormOpen(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {editingId ? '保存' : '创建'}
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <ScheduleForm
            form={form}
            isEdit={!!editingId}
            userEmail={emailConfig?.email}
          />
        </Form>
      </Modal>
    </>
  );
}

export default ReportScheduleSettings;
