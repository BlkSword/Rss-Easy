/**
 * AI配置设置组件 - 增强交互反馈
 */

'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Save, AlertCircle, Zap, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface AISettingsProps {
  user: any;
}

type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'custom';

const providers = [
  { value: 'openai' as AIProvider, label: 'OpenAI', desc: 'GPT-4, GPT-3.5' },
  { value: 'anthropic' as AIProvider, label: 'Anthropic', desc: 'Claude 3' },
  { value: 'deepseek' as AIProvider, label: 'DeepSeek', desc: 'DeepSeek-V3' },
  { value: 'ollama' as AIProvider, label: 'Ollama', desc: '本地模型' },
  { value: 'custom' as AIProvider, label: '自定义', desc: '兼容 OpenAI API' },
];

export function AISettings({ user }: AISettingsProps) {
  const aiConfig = user?.aiConfig || {};

  const [provider, setProvider] = useState<AIProvider>(aiConfig.provider || 'openai');
  const [model, setModel] = useState(aiConfig.model || '');
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState(aiConfig.baseURL || '');
  const [autoSummary, setAutoSummary] = useState(aiConfig.autoSummary ?? true);
  const [autoCategorize, setAutoCategorize] = useState(aiConfig.autoCategorize ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const { mutate: updateAIConfig } = trpc.settings.updateAIConfig.useMutation();

  // 当提供商改变时，设置默认模型
  useEffect(() => {
    if (!aiConfig.model) {
      switch (provider) {
        case 'openai':
          setModel('gpt-4o-mini');
          break;
        case 'anthropic':
          setModel('claude-3-5-sonnet-20241022');
          break;
        case 'deepseek':
          setModel('deepseek-chat');
          break;
        case 'ollama':
          setModel('llama3.2');
          break;
        case 'custom':
          setModel('');
          break;
      }
    } else {
      setModel(aiConfig.model);
    }
  }, [provider]);

  const hasChanges =
    provider !== aiConfig.provider ||
    model !== aiConfig.model ||
    baseURL !== aiConfig.baseURL ||
    apiKey !== '' ||
    autoSummary !== (aiConfig.autoSummary ?? true) ||
    autoCategorize !== (aiConfig.autoCategorize ?? true);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAIConfig({
        provider,
        model,
        apiKey: apiKey || undefined,
        baseURL: baseURL || undefined,
        autoSummary,
        autoCategorize,
      });
      setApiKey('');
      notifySuccess('AI配置已更新');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const needsApiKey = provider !== 'ollama';
  const needsBaseURL = provider === 'custom' || provider === 'ollama';

  return (
    <div className="space-y-6">
      {/* AI提供商配置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI提供商
          </CardTitle>
          <CardDescription>选择并配置您想使用的AI服务</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 提供商选择 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">AI提供商</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {providers.map((item) => {
                const isActive = provider === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setProvider(item.value)}
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
                    <Zap className={cn(
                      'relative h-6 w-6 transition-all duration-250',
                      isActive ? 'text-primary scale-110' : 'text-muted-foreground group-hover:scale-110 group-hover:text-primary/80'
                    )} />
                    <div className="relative text-center">
                      <div className={cn(
                        'text-sm font-medium transition-colors',
                        isActive ? 'text-primary' : 'group-hover:text-foreground'
                      )}>
                        {item.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 模型名称 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">模型名称</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="输入模型名称"
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200 input-warm',
                'placeholder:text-muted-foreground/50'
              )}
            />
          </div>

          {/* API密钥 */}
          {needsApiKey && (
            <div className="space-y-2">
              <label className="text-sm font-medium">API密钥</label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={aiConfig.apiKey ? '••••••••••••••••（已配置）' : '输入API密钥'}
                  className={cn(
                    'w-full px-4 py-3 pr-24 rounded-xl border-2 border-border bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                    'transition-all duration-200 input-warm',
                    'placeholder:text-muted-foreground/50'
                  )}
                />
                {aiConfig.apiKey && !apiKey && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">已配置</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {aiConfig.apiKey ? '留空保持现有密钥不变' : '请输入您的API密钥'}
              </p>
            </div>
          )}

          {/* 自定义API地址 */}
          {needsBaseURL && (
            <div className="space-y-2">
              <label className="text-sm font-medium">API地址</label>
              <input
                type="text"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder={
                  provider === 'ollama'
                    ? 'http://localhost:11434'
                    : 'https://api.example.com/v1'
                }
                className={cn(
                  'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                  'transition-all duration-200 input-warm',
                  'placeholder:text-muted-foreground/50'
                )}
              />
              <p className="text-xs text-muted-foreground">
                {provider === 'ollama'
                  ? 'Ollama服务地址，默认为 http://localhost:11434'
                  : '自定义API的基础URL'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI功能设置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>AI功能</CardTitle>
          <CardDescription>配置AI功能的自动触发行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: 'autoSummary',
              value: autoSummary,
              onChange: setAutoSummary,
              title: '自动摘要',
              description: '新文章抓取后自动生成AI摘要',
              icon: Sparkles,
            },
            {
              key: 'autoCategorize',
              value: autoCategorize,
              onChange: setAutoCategorize,
              title: '自动分类',
              description: '使用AI自动为文章分配分类和标签',
              icon: Check,
            },
          ].map(({ key, value, onChange, title, description, icon: Icon }) => (
            <div
              key={key}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
                'hover:border-primary/25 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
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
                  <Icon className={cn(
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

      {/* 使用提示 */}
      <Card className="border-primary/20 bg-primary/5 overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-sm">使用提示</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>API密钥将被加密存储，请妥善保管</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>使用本地模型（Ollama）无需API密钥</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>AI功能可能产生额外费用，请查看各提供商定价</span>
                </li>
              </ul>
            </div>
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
