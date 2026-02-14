/**
 * 报告邮件设置组件
 * 配置日报/周报的自动发送设置
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, Clock, Calendar, Bell, Check, X } from 'lucide-react';
import { Modal, Switch, TimePicker, Select, Space, Button, Divider, Alert } from 'antd';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// 启用自定义解析格式插件
dayjs.extend(customParseFormat);

interface ReportEmailSettingsProps {
  open: boolean;
  onClose: () => void;
}

const weekDays = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
];

export function ReportEmailSettings({ open, onClose }: ReportEmailSettingsProps) {
  const { data: settings, isLoading } = trpc.settings.getReportEmailSettings.useQuery(undefined, {
    enabled: open,
  });
  const { data: emailConfig } = trpc.reports.checkEmailConfig.useQuery(undefined, {
    enabled: open,
  });
  
  const updateSettings = trpc.settings.updateReportEmailSettings.useMutation();

  const [autoSendDaily, setAutoSendDaily] = useState(false);
  const [autoSendWeekly, setAutoSendWeekly] = useState(false);
  const [dailySendTime, setDailySendTime] = useState(dayjs('09:00', 'HH:mm'));
  const [weeklySendDay, setWeeklySendDay] = useState(1);
  const [weeklySendTime, setWeeklySendTime] = useState(dayjs('09:00', 'HH:mm'));
  const [isSaving, setIsSaving] = useState(false);

  // 当设置数据加载后更新本地状态
  useEffect(() => {
    if (settings) {
      setAutoSendDaily(settings.autoSendDaily);
      setAutoSendWeekly(settings.autoSendWeekly);
      setDailySendTime(dayjs(settings.dailySendTime, 'HH:mm'));
      setWeeklySendDay(settings.weeklySendDay);
      setWeeklySendTime(dayjs(settings.weeklySendTime, 'HH:mm'));
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({
        autoSendDaily,
        autoSendWeekly,
        dailySendTime: dailySendTime.format('HH:mm'),
        weeklySendDay,
        weeklySendTime: weeklySendTime.format('HH:mm'),
      });
      notifySuccess('设置已保存');
      onClose();
    } catch (error: any) {
      notifyError(error.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = settings && (
    autoSendDaily !== settings.autoSendDaily ||
    autoSendWeekly !== settings.autoSendWeekly ||
    dailySendTime.format('HH:mm') !== settings.dailySendTime ||
    weeklySendDay !== settings.weeklySendDay ||
    weeklySendTime.format('HH:mm') !== settings.weeklySendTime
  );

  const emailNotConfigured = !emailConfig?.enabled || !emailConfig?.configured;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <span>报告邮件设置</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={isSaving}
          disabled={!hasChanges || isSaving || emailNotConfigured}
          onClick={handleSave}
          icon={<Check className="h-4 w-4" />}
        >
          保存设置
        </Button>,
      ]}
      width={560}
    >
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          <div className="animate-pulse">加载中...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 邮件服务状态提示 */}
          {emailNotConfigured && (
            <Alert
              type="warning"
              showIcon
              message="邮件服务未配置"
              description="请先前往设置页面配置邮件服务，才能使用自动发送功能。"
              action={
                <Button size="small" type="primary" href="/settings?tab=email">
                  前往配置
                </Button>
              }
            />
          )}

          {/* 日报设置 */}
          <div className={cn(
            'rounded-xl border-2 p-5 transition-all duration-300',
            autoSendDaily
              ? 'border-blue-200 bg-blue-50/50'
              : 'border-border/60 bg-muted/20'
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300',
                  autoSendDaily ? 'bg-blue-500 text-white' : 'bg-muted'
                )}>
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className={cn(
                    'font-medium transition-colors',
                    autoSendDaily ? 'text-blue-700' : 'text-foreground'
                  )}>
                    自动发送日报
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    每天定时发送日报到邮箱
                  </p>
                </div>
              </div>
              <Switch
                checked={autoSendDaily}
                onChange={setAutoSendDaily}
                disabled={emailNotConfigured}
              />
            </div>

            {autoSendDaily && (
              <div className="pl-13 ml-13 mt-4 pt-4 border-t border-blue-200/50">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">发送时间：</span>
                  <TimePicker
                    value={dailySendTime}
                    onChange={(time) => time && setDailySendTime(time)}
                    format="HH:mm"
                    disabled={emailNotConfigured}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  每天 {dailySendTime.format('HH:mm')} 自动发送前一天日报到 {emailConfig?.email || '您的邮箱'}
                </p>
              </div>
            )}
          </div>

          {/* 周报设置 */}
          <div className={cn(
            'rounded-xl border-2 p-5 transition-all duration-300',
            autoSendWeekly
              ? 'border-purple-200 bg-purple-50/50'
              : 'border-border/60 bg-muted/20'
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300',
                  autoSendWeekly ? 'bg-purple-500 text-white' : 'bg-muted'
                )}>
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className={cn(
                    'font-medium transition-colors',
                    autoSendWeekly ? 'text-purple-700' : 'text-foreground'
                  )}>
                    自动发送周报
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    每周定时发送周报到邮箱
                  </p>
                </div>
              </div>
              <Switch
                checked={autoSendWeekly}
                onChange={setAutoSendWeekly}
                disabled={emailNotConfigured}
              />
            </div>

            {autoSendWeekly && (
              <div className="pl-13 ml-13 mt-4 pt-4 border-t border-purple-200/50 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">发送日期：</span>
                  <Select
                    value={weeklySendDay}
                    onChange={setWeeklySendDay}
                    style={{ width: 120 }}
                    disabled={emailNotConfigured}
                    options={weekDays}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">发送时间：</span>
                  <TimePicker
                    value={weeklySendTime}
                    onChange={(time) => time && setWeeklySendTime(time)}
                    format="HH:mm"
                    disabled={emailNotConfigured}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  每周{weekDays.find(d => d.value === weeklySendDay)?.label} {weeklySendTime.format('HH:mm')} 自动发送上周周报到 {emailConfig?.email || '您的邮箱'}
                </p>
              </div>
            )}
          </div>

          <Divider />

          {/* 说明 */}
          <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p>• 自动发送功能需要邮件服务已配置并启用</p>
                <p>• 报告将在生成完成后自动发送到您的邮箱</p>
                <p>• 您也可以随时手动发送报告</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ReportEmailSettings;
