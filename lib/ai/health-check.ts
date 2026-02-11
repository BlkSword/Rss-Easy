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
    let isConfigError = false;

    // 检查状态码
    if (error.status === 404) {
      errorMessage = 'API地址或模型名称不正确 (404)\n请检查：\n1. API Base URL 是否完整（包含正确的路径后缀）\n2. 模型名称是否在该平台上可用\n3. 参考官方文档确认正确的 API 地址格式';
      isConfigError = true;
    } else if (error.status === 401) {
      errorMessage = 'API密钥无效或已过期 (401)';
      isConfigError = true;
    } else if (error.status === 403) {
      errorMessage = 'API访问被拒绝，请检查权限 (403)';
      isConfigError = true;
    } else if (error.status === 429) {
      errorMessage = 'API调用频率超限，请稍后重试 (429)';
    } else if (error.status === 500) {
      errorMessage = 'API服务器内部错误，请稍后重试 (500)';
    } else if (error.status === 502 || error.status === 503) {
      errorMessage = 'API服务暂时不可用，请稍后重试';
    } else if (errorMessage.includes('API key')) {
      errorMessage = 'API密钥无效或已过期';
      isConfigError = true;
    } else if (errorMessage.includes('rate limit')) {
      errorMessage = 'API调用频率超限，请稍后重试';
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = '网络连接失败，请检查网络设置和API地址';
    } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
      errorMessage = '模型不可用，请检查模型名称是否正确';
      isConfigError = true;
    } else if (errorMessage.includes('ENOTFOUND')) {
      errorMessage = '无法解析API地址，请检查 baseURL 是否正确';
      isConfigError = true;
    }

    // 如果是配置错误，添加更详细的诊断信息
    if (isConfigError && config?.baseURL) {
      const url = config.baseURL;
      const diagnostics = [];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        diagnostics.push('• URL 必须以 http:// 或 https:// 开头');
      }
      // 检查是否以斜杠结尾（可能不完整）
      if (url.endsWith('/')) {
        diagnostics.push('• URL 不应以斜杠结尾，请检查 API 文档确认完整路径');
      }
      if (diagnostics.length > 0) {
        errorMessage += '\n\n诊断建议：\n' + diagnostics.join('\n');
      }
    }

    return {
      success: false,
      message: isConfigError ? 'AI配置错误' : 'AI服务连接失败',
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
