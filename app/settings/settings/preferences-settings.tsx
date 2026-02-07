/**
 * 偏好设置组件 - 增强交互反馈
 */

'use client';

import { useState, useEffect } from 'react';
import { Palette, Save, Sun, Moon, Monitor, Type, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface PreferencesSettingsProps {
  user: any;
}

type Theme = 'light' | 'dark' | 'system';
type Language = 'zh-CN' | 'en';
type FontSize = 'small' | 'medium' | 'large';

export function PreferencesSettings({ user }: PreferencesSettingsProps) {
  const prefs = user?.preferences || {};

  const [theme, setTheme] = useState<Theme>(prefs.theme || 'system');
  const [language, setLanguage] = useState<Language>(prefs.language || 'zh-CN');
  const [fontSize, setFontSize] = useState<FontSize>(prefs.fontSize || 'medium');
  const [itemsPerPage, setItemsPerPage] = useState(prefs.itemsPerPage || 20);
  const [autoMarkAsRead, setAutoMarkAsRead] = useState(prefs.autoMarkAsRead ?? true);
  const [showFullContent, setShowFullContent] = useState(prefs.showFullContent ?? false);
  const [showUnreadCount, setShowUnreadCount] = useState(prefs.showUnreadCount ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const { mutate: updatePreferences } = trpc.settings.updatePreferences.useMutation();

  const hasChanges =
    theme !== prefs.theme ||
    language !== prefs.language ||
    fontSize !== prefs.fontSize ||
    itemsPerPage !== prefs.itemsPerPage ||
    autoMarkAsRead !== (prefs.autoMarkAsRead ?? true) ||
    showFullContent !== (prefs.showFullContent ?? false) ||
    showUnreadCount !== (prefs.showUnreadCount ?? true);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        theme,
        language,
        fontSize,
        itemsPerPage,
        autoMarkAsRead,
        showFullContent,
        showUnreadCount,
      });
      notifySuccess('偏好设置已更新');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 外观设置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            外观设置
          </CardTitle>
          <CardDescription>自定义应用的外观和显示方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 主题选择 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">主题</label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { value: 'light', icon: Sun, label: '浅色' },
                  { value: 'dark', icon: Moon, label: '深色' },
                  { value: 'system', icon: Monitor, label: '跟随系统' },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = theme === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setTheme(item.value)}
                    className={cn(
                      'option-item group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-250',
                      isActive
                        ? 'border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 shadow-md'
                        : 'border-border hover:border-primary/25'
                    )}
                  >
                    <span className={cn(
                      'absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                      !isActive && 'group-hover:opacity-100'
                    )} />
                    <Icon className={cn(
                      'relative h-6 w-6 transition-all duration-250',
                      isActive ? 'text-primary scale-110' : 'text-muted-foreground group-hover:scale-110 group-hover:text-primary/80'
                    )} />
                    <span className={cn(
                      'relative text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : 'group-hover:text-foreground'
                    )}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 字体大小 */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              字体大小
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { value: 'small', label: '小', desc: '14px' },
                  { value: 'medium', label: '中', desc: '16px' },
                  { value: 'large', label: '大', desc: '18px' },
                ] as const
              ).map((item) => {
                const isActive = fontSize === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setFontSize(item.value)}
                    className={cn(
                      'option-item group relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-250',
                      isActive
                        ? 'border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/25'
                    )}
                  >
                    <span className={cn(
                      'absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                      !isActive && 'group-hover:opacity-100'
                    )} />
                    <span className={cn(
                      'relative text-base font-medium transition-all duration-200',
                      isActive ? 'text-primary scale-110' : 'group-hover:text-foreground'
                    )}>
                      {item.label}
                    </span>
                    <span className="relative text-xs text-muted-foreground">{item.desc}</span>
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 语言 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">语言</label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'en', label: 'English' },
                ] as const
              ).map((item) => {
                const isActive = language === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setLanguage(item.value)}
                    className={cn(
                      'option-item group relative p-3 rounded-xl border-2 text-center transition-all duration-250',
                      isActive
                        ? 'border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-medium shadow-sm'
                        : 'border-border hover:border-primary/25'
                    )}
                  >
                    <span className={cn(
                      'absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                      !isActive && 'group-hover:opacity-100'
                    )} />
                    <span className="relative">{item.label}</span>
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 阅读设置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            阅读设置
          </CardTitle>
          <CardDescription>配置阅读和文章显示行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 每页显示文章数 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">每页显示文章数</label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm cursor-pointer hover:border-primary/30'
              )}
            >
              <option value={10}>10 篇</option>
              <option value={20}>20 篇</option>
              <option value={50}>50 篇</option>
              <option value={100}>100 篇</option>
            </select>
          </div>

          {/* 开关选项 */}
          {[
            {
              key: 'autoMarkAsRead',
              value: autoMarkAsRead,
              onChange: setAutoMarkAsRead,
              title: '自动标记为已读',
              description: '点击文章后自动标记为已读',
            },
            {
              key: 'showFullContent',
              value: showFullContent,
              onChange: setShowFullContent,
              title: '显示完整内容',
              description: '在列表中显示文章完整内容而非摘要',
            },
            {
              key: 'showUnreadCount',
              value: showUnreadCount,
              onChange: setShowUnreadCount,
              title: '显示未读计数',
              description: '在订阅源旁边显示未读文章数量',
            },
          ].map(({ key, value, onChange, title, description }) => (
            <div
              key={key}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
                'hover:border-primary/25 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
                value ? 'border-primary/20 bg-primary/[0.03]' : 'border-border/80'
              )}
              onClick={() => onChange(!value)}
            >
              <div className="flex-1">
                <div className={cn(
                  'font-medium transition-colors duration-200',
                  value ? 'text-primary' : 'group-hover:text-primary/90'
                )}>{title}</div>
                <div className="text-sm text-muted-foreground mt-1">{description}</div>
              </div>
              <button
                className={cn(
                  'toggle-switch relative w-12 h-6 rounded-full transition-all duration-300',
                  value
                    ? 'bg-primary shadow-md shadow-primary/20'
                    : 'bg-muted hover:bg-muted/70'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(!value);
                }}
              >
                <span
                  className={cn(
                    'toggle-knob absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300',
                    value ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
          ))}
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
