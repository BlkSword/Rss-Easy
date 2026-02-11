/**
 * AI配置设置组件 - 增强交互反馈
 */

'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Save, AlertCircle, Zap, Check, Copy, TestTube, Loader2 } from 'lucide-react';
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
  const [aiQueueEnabled, setAiQueueEnabled] = useState(aiConfig.aiQueueEnabled ?? true);  // AI分析队列启用状态
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasApiKeyInDb, setHasApiKeyInDb] = useState(!!aiConfig.apiKey);  // 追踪数据库中是否有密钥

  const utils = trpc.useUtils();  // 获取 utils 用于刷新查询

  const { mutate: updateAIConfig } = trpc.settings.updateAIConfig.useMutation();
  const { mutate: testAIConfig } = trpc.settings.testAIConfig.useMutation();

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

  // 检查是否有变化：apiKey 只有在用户输入新内容时才算变化
  const hasNewApiKey = apiKey.trim() !== '';
  const hasChanges =
    provider !== aiConfig.provider ||
    model !== aiConfig.model ||
    baseURL !== aiConfig.baseURL ||
    hasNewApiKey ||  // 只有当用户输入了新密钥时才算变化
    autoSummary !== (aiConfig.autoSummary ?? true) ||
    autoCategorize !== (aiConfig.autoCategorize ?? true) ||
    aiQueueEnabled !== (aiConfig.aiQueueEnabled ?? true);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 构建更新数据：只有当用户输入了新密钥时才更新 apiKey
      const updateData: any = {
        provider,
        model,
        baseURL: baseURL || undefined,
        autoSummary,
        autoCategorize,
        aiQueueEnabled,
      };

      // 只有当用户输入了新密钥时才更新 apiKey
      if (apiKey.trim() !== '') {
        updateData.apiKey = apiKey.trim();
      }

      await updateAIConfig(updateData);

      // 如果保存了新密钥，更新状态标记
      if (apiKey.trim() !== '') {
        setHasApiKeyInDb(true);
      }

      // 清空输入框（但不清空数据库中的密钥）
      setApiKey('');

      // 刷新用户数据，确保父组件的 user 对象更新
      await utils.auth.me.invalidate();

      notifySuccess('AI配置已更新');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      // 构建测试配置（使用当前表单的值）
      const testConfig: any = {
        provider,
        model,
        baseURL: baseURL || undefined,
      };

      // 只有当用户输入了新密钥时才在测试配置中包含 apiKey
      // 否则不传 apiKey，让后端从数据库读取
      if (apiKey.trim() !== '') {
        testConfig.apiKey = apiKey.trim();
      }
      // 如果输入框为空，不要添加 apiKey 字段（即使是 undefined）
      // 这样后端会从数据库读取已有的密钥

      // 先保存配置
      const updateData: any = {
        provider,
        model,
        baseURL: baseURL || undefined,
        autoSummary,
        autoCategorize,
      };

      // 只有当用户输入了新密钥时才更新 apiKey
      if (apiKey.trim() !== '') {
        updateData.apiKey = apiKey.trim();
      }

      await updateAIConfig(updateData);

      // 如果保存了新密钥，更新状态标记
      if (apiKey.trim() !== '') {
        setHasApiKeyInDb(true);
      }

      // 刷新用户数据
      await utils.auth.me.invalidate();

      // 使用当前配置测试连接
      const result = await new Promise<any>((resolve, reject) => {
        testAIConfig(testConfig, {
          onSuccess: resolve,
          onError: reject,
        });
      });

      if (result.success) {
        notifySuccess('连接测试成功', `已成功连接到 ${result.provider || provider} API`);
      } else {
        notifyError('连接测试失败', result.error || result.message);
      }
    } catch (error: any) {
      notifyError('测试失败', error.message || '无法连接到AI服务');
    } finally {
      setIsTesting(false);
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
                  placeholder={hasApiKeyInDb ? '••••••••••••••••（已配置）' : '输入API密钥'}
                  className={cn(
                    'w-full px-4 py-3 pr-24 rounded-xl border-2 border-border bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                    'transition-all duration-200 input-warm',
                    'placeholder:text-muted-foreground/50'
                  )}
                />
                {hasApiKeyInDb && !apiKey && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">已配置</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasApiKeyInDb ? '留空保持现有密钥不变，输入新密钥将替换' : '请输入您的API密钥'}
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
                  : 'OpenAI兼容API的基础URL（注意：通常需要包含 /v1 后缀）'}
              </p>
              {provider === 'custom' && (
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs font-medium text-foreground mb-1">常用API示例：</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 月之暗面(Moonshot): https://api.moonshot.cn/v1</li>
                    <li>• 通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1</li>
                    <li>• 智谱GLM: https://open.bigmodel.cn/api/paas/v4</li>
                    <li>• DeepSeek: https://api.deepseek.com</li>
                    <li>• LongCat: https://api.longcat.chat/openai</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    注意：不同服务使用的路径后缀不同，请参考各服务的官方文档。
                  </p>
                </div>
              )}
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
            {
              key: 'aiQueueEnabled',
              value: aiQueueEnabled,
              onChange: setAiQueueEnabled,
              title: 'AI分析队列',
              description: '启用后台AI分析队列，自动处理文章深度分析',
              icon: Zap,
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
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          isLoading={isTesting}
          disabled={isTesting || isSaving}
          leftIcon={isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
        >
          {isTesting ? '测试中...' : '测试连接'}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!hasChanges || isSaving || isTesting}
          leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          保存更改
        </Button>
      </div>
    </div>
  );
}
