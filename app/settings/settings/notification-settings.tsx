/**
 * 通知设置组件
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface NotificationSettingsProps {
  user: any;
}

export function NotificationSettings({ user }: NotificationSettingsProps) {
  const prefs = user?.preferences || {};

  const [emailNotifications, setEmailNotifications] = useState(
    prefs.emailNotifications ?? false
  );
  const [digestFrequency, setDigestFrequency] = useState(
    prefs.digestFrequency || 'daily'
  );
  const [notifyNewEntries, setNotifyNewEntries] = useState(
    prefs.notifyNewEntries ?? false
  );
  const [notifyErrors, setNotifyErrors] = useState(prefs.notifyErrors ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const { mutate: updatePreferences } = trpc.settings.updatePreferences.useMutation();

  const hasChanges =
    emailNotifications !== (prefs.emailNotifications ?? false) ||
    digestFrequency !== prefs.digestFrequency ||
    notifyNewEntries !== (prefs.notifyNewEntries ?? false) ||
    notifyErrors !== (prefs.notifyErrors ?? true);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        emailNotifications,
        digestFrequency,
        notifyNewEntries,
        notifyErrors,
      });
      notifySuccess('通知设置已更新');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 邮件通知 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            邮件通知
          </CardTitle>
          <CardDescription>选择您希望接收的邮件通知类型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 启用邮件通知 */}
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
              'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
              emailNotifications 
                ? 'border-primary/50 bg-gradient-to-r from-primary/[0.08] to-primary/[0.03] shadow-sm' 
                : 'border-border/80 bg-muted/20'
            )}
            onClick={() => setEmailNotifications(!emailNotifications)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                emailNotifications ? 'bg-primary/20 shadow-sm' : 'bg-muted/60 group-hover:bg-primary/10'
              )}>
                <Mail className={cn(
                  'h-5 w-5 transition-all duration-250',
                  emailNotifications ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary/60'
                )} />
              </div>
              <div>
                <div className={cn(
                  'font-medium transition-colors duration-200',
                  emailNotifications ? 'text-primary' : 'group-hover:text-primary/90'
                )}>启用邮件通知</div>
                <div className="text-sm text-muted-foreground mt-1">
                  通过邮件接收重要通知和摘要
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEmailNotifications(!emailNotifications);
              }}
              className={cn(
                'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                emailNotifications
                  ? 'bg-slate-300 dark:bg-slate-600'
                  : 'bg-primary shadow-lg shadow-primary/30'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                  emailNotifications 
                    ? 'left-8 bg-white' 
                    : 'left-1 bg-white'
                )}
              />
            </button>
          </div>

          {/* 摘要频率 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">摘要频率</label>
            <select
              value={digestFrequency}
              onChange={(e) => setDigestFrequency(e.target.value)}
              disabled={!emailNotifications}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm cursor-pointer',
                emailNotifications
                  ? 'border-border hover:border-primary/30'
                  : 'border-border/60 opacity-50 cursor-not-allowed'
              )}
            >
              <option value="realtime">实时</option>
              <option value="hourly">每小时</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
            </select>
            <p className="text-xs text-muted-foreground">
              选择您希望接收文章摘要的频率
            </p>
          </div>

          {/* 新文章通知 */}
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
              'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
              !emailNotifications && 'opacity-60 cursor-not-allowed hover:border-border/80 hover:bg-muted/30',
              notifyNewEntries && emailNotifications 
                ? 'border-primary/50 bg-gradient-to-r from-primary/[0.08] to-primary/[0.03] shadow-sm' 
                : 'border-border/80 bg-muted/30'
            )}
            onClick={() => emailNotifications && setNotifyNewEntries(!notifyNewEntries)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                notifyNewEntries && emailNotifications ? 'bg-primary/20 shadow-sm' : 'bg-muted/60 group-hover:bg-primary/10'
              )}>
                <Bell className={cn(
                  'h-5 w-5 transition-all duration-250',
                  notifyNewEntries && emailNotifications ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary/60'
                )} />
              </div>
              <div>
                <div className={cn(
                  'font-medium transition-colors duration-200',
                  notifyNewEntries && emailNotifications ? 'text-primary' : 'group-hover:text-primary/90'
                )}>新文章通知</div>
                <div className="text-sm text-muted-foreground mt-1">
                  关注的订阅源有新文章时通知
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotifyNewEntries(!notifyNewEntries);
              }}
              disabled={!emailNotifications}
              className={cn(
                'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                notifyNewEntries && emailNotifications
                  ? 'bg-slate-300 dark:bg-slate-600'
                  : 'bg-primary shadow-lg shadow-primary/30',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                  notifyNewEntries 
                    ? 'left-8 bg-white' 
                    : 'left-1 bg-white'
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 应用通知 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            应用通知
          </CardTitle>
          <CardDescription>配置应用内的通知行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 错误通知 */}
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
              'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
              notifyErrors 
                ? 'border-primary/50 bg-gradient-to-r from-primary/[0.08] to-primary/[0.03] shadow-sm' 
                : 'border-border/80 bg-muted/20'
            )}
            onClick={() => setNotifyErrors(!notifyErrors)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                notifyErrors ? 'bg-primary/20 shadow-sm' : 'bg-muted/60 group-hover:bg-primary/10'
              )}>
                <Bell className={cn(
                  'h-5 w-5 transition-all duration-250',
                  notifyErrors ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary/60'
                )} />
              </div>
              <div>
                <div className={cn(
                  'font-medium transition-colors duration-200',
                  notifyErrors ? 'text-primary' : 'group-hover:text-primary/90'
                )}>错误通知</div>
                <div className="text-sm text-muted-foreground mt-1">
                  订阅源抓取失败时显示通知
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotifyErrors(!notifyErrors);
              }}
              className={cn(
                'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                notifyErrors
                  ? 'bg-slate-300 dark:bg-slate-600'
                  : 'bg-primary shadow-lg shadow-primary/30'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                  notifyErrors 
                    ? 'left-8 bg-white' 
                    : 'left-1 bg-white'
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!hasChanges || isSaving}
          leftIcon={<Save className="h-4 w-4" />}
        >
          保存更改
        </Button>
      </div>
    </div>
  );
}
