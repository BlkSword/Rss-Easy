/**
 * AI服务健康检查
 * 用于验证LLM配置是否正确
 */

import { AIService } from './client';

export interface HealthCheckResult {
  success: boolean;
  message: string;
  provider?: string;
  model?: string;
  error?: string;
}

/**
 * 检查AI配置是否可用
 */
export async function checkAIConfig(config?: any): Promise<HealthCheckResult> {
  try {
    // 检查是否有配置
    if (!config) {
      // 尝试从环境变量获取
      const envKey = process.env.OPENAI_API_KEY || 
                     process.env.ANTHROPIC_API_KEY ||
                     process.env.DEEPSEEK_API_KEY;
      
      if (!envKey) {
        return {
          success: false,
          message: '未配置AI服务',
          error: '请在设置中配置AI提供商和API密钥，或设置环境变量'
        };
      }
    }

    const provider = config?.provider || 'openai';
    const model = config?.model || 'gpt-4o';
    const apiKey = config?.apiKey;
    const baseURL = config?.baseURL;

    // 检查API密钥
    if (!apiKey && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        message: '缺少API密钥',
        error: '请在设置中配置API密钥',
        provider,
        model
      };
    }

    // 创建AI服务实例
    const aiService = new AIService({
      provider,
      model,
      apiKey,
      baseURL,
      maxTokens: 50,
      temperature: 0.1,
    });

    // 发送测试请求
    const response = await aiService.chat({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply with a simple "OK".' },
        { role: 'user', content: 'Test connection' }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    if (response.content && response.content.length > 0) {
      return {
        success: true,
        message: 'AI服务连接正常',
        provider,
        model
      };
    } else {
      return {
        success: false,
        message: 'AI服务响应异常',
        error: '收到空响应',
        provider,
        model
      };
    }

  } catch (error: any) {
    console.error('AI健康检查失败:', error);
    
    // 分析错误类型
    let errorMessage = error.message || '未知错误';
    
    if (errorMessage.includes('API key')) {
      errorMessage = 'API密钥无效或已过期';
    } else if (errorMessage.includes('rate limit')) {
      errorMessage = 'API调用频率超限，请稍后重试';
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      errorMessage = '网络连接失败，请检查网络设置';
    } else if (errorMessage.includes('model')) {
      errorMessage = '模型不可用，请检查模型名称是否正确';
    }

    return {
      success: false,
      message: 'AI服务连接失败',
      error: errorMessage,
      provider: config?.provider || 'openai',
      model: config?.model || 'gpt-4o'
    };
  }
}

/**
 * 获取用户的AI配置
 */
export async function getUserAIConfig(userId: string, db: any) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiConfig: true }
  });

  return user?.aiConfig as {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
  } | null;
}
