/**
 * 偏好设置组件 - 增强交互反馈
 */

'use client';

import { useState, useEffect } from 'react';
import { Palette, Save, Sun, Moon, Monitor, List, Check, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers/theme-provider';
import { useLanguage } from '@/components/providers/language-provider';

interface PreferencesSettingsProps {
  user: any;
}

type Theme = 'light' | 'dark' | 'system';
type Language = 'zh-CN' | 'en';

export function PreferencesSettings({ user }: PreferencesSettingsProps) {
  const prefs = user?.preferences || {};
  const { setTheme: setGlobalTheme } = useTheme();
  const { setLanguage: setGlobalLanguage, t } = useLanguage();

  const [theme, setThemeState] = useState<Theme>(prefs.theme || 'system');
  const [language, setLanguageState] = useState<Language>(prefs.language || 'zh-CN');
  const [itemsPerPage, setItemsPerPage] = useState(prefs.itemsPerPage || 20);
  const [autoMarkAsRead, setAutoMarkAsRead] = useState(prefs.autoMarkAsRead ?? true);
  const [showFullContent, setShowFullContent] = useState(prefs.showFullContent ?? false);
  const [showUnreadCount, setShowUnreadCount] = useState(prefs.showUnreadCount ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const { mutate: updatePreferences } = trpc.settings.updatePreferences.useMutation();

  // 同步本地状态与用户数据
  useEffect(() => {
    if (prefs.theme) setThemeState(prefs.theme);
    if (prefs.language) {
      setLanguageState(prefs.language);
      setGlobalLanguage(prefs.language);
    }
  }, [prefs.theme, prefs.language, setGlobalLanguage]);

  const handleThemeChange = (newTheme: Theme) => {
    setThemeState(newTheme);
    setGlobalTheme(newTheme);
  };

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    setGlobalLanguage(newLanguage);
  };

  const hasChanges =
    theme !== prefs.theme ||
    language !== prefs.language ||
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
        itemsPerPage,
        autoMarkAsRead,
        showFullContent,
        showUnreadCount,
      });
      notifySuccess(t('toast.saved'));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t('toast.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('theme.light') },
    { value: 'dark' as const, icon: Moon, label: t('theme.dark') },
    { value: 'system' as const, icon: Monitor, label: t('theme.system') },
  ];

  const languageOptions = [
    { value: 'zh-CN' as const, label: '简体中文' },
    { value: 'en' as const, label: 'English' },
  ];

  return (
    <div className="space-y-6">
      {/* 外观设置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            {t('settings.appearance')}
          </CardTitle>
          <CardDescription>{t('settings.appearance_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 主题选择 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t('settings.theme')}</label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((item) => {
                const Icon = item.icon;
                const isActive = theme === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleThemeChange(item.value)}
                    className={cn(
                      'option-item group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-250',
                      isActive
                        ? 'border-primary/60 bg-gradient-to-br from-primary/15 to-primary/5 shadow-md ring-2 ring-primary/10'
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

          {/* 语言 */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              {t('settings.language')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {languageOptions.map((item) => {
                const isActive = language === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleLanguageChange(item.value)}
                    className={cn(
                      'option-item group relative p-4 rounded-xl border-2 text-center transition-all duration-250 flex items-center justify-center gap-2',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-md ring-1 ring-primary/20'
                        : 'border-border/80 hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    {isActive && (
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="relative">{item.label}</span>
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
            {t('settings.reading')}
          </CardTitle>
          <CardDescription>{t('settings.reading_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 每页显示文章数 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.items_per_page')}</label>
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
                'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
                value 
                  ? 'border-primary/50 bg-gradient-to-r from-primary/[0.08] to-primary/[0.03] shadow-sm' 
                  : 'border-border/80 bg-muted/20'
              )}
              onClick={() => onChange(!value)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                  value ? 'bg-primary/20 shadow-sm' : 'bg-muted/60 group-hover:bg-primary/10'
                )}>
                  <Check className={cn(
                    'h-5 w-5 transition-all duration-250',
                    value ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary/60'
                  )} />
                </div>
                <div>
                  <div className={cn(
                    'font-medium transition-colors duration-200',
                    value ? 'text-primary' : 'group-hover:text-primary/90'
                  )}>{title}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </div>
              </div>
              <button
                className={cn(
                  'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                  value
                    ? 'bg-slate-300 dark:bg-slate-600'
                    : 'bg-primary shadow-lg shadow-primary/30'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(!value);
                }}
              >
                <span
                  className={cn(
                    'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                    value 
                      ? 'left-8 bg-white' 
                      : 'left-1 bg-white'
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
          {t('action.save')}
        </Button>
      </div>
    </div>
  );
}
