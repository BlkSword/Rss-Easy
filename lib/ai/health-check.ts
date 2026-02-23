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

/** 健康检查超时时间（毫秒） */
const HEALTH_CHECK_TIMEOUT = 8000;

/**
 * 带超时的 Promise 包装
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * 快速检查AI配置是否存在（不调用API）
 */
export function checkAIConfigExists(config?: any): { exists: boolean; provider: string; model: string; apiKey: string | undefined } {
  const provider = config?.provider || process.env.AI_PROVIDER || '';
  const model = config?.model || process.env.AI_MODEL || '';

  // 检查各种可能的 API Key 来源
  let apiKey = config?.apiKey;

  if (!apiKey) {
    switch (provider) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'deepseek':
        apiKey = process.env.DEEPSEEK_API_KEY;
        break;
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY;
        break;
      case 'custom':
        apiKey = process.env.CUSTOM_API_KEY;
        break;
      default:
        // 如果没有指定 provider，检查所有可能的环境变量
        apiKey = process.env.OPENAI_API_KEY ||
                 process.env.ANTHROPIC_API_KEY ||
                 process.env.DEEPSEEK_API_KEY ||
                 process.env.GEMINI_API_KEY;
    }
  }

  return {
    exists: !!apiKey,
    provider,
    model,
    apiKey: apiKey ? '***' : undefined, // 不暴露实际密钥
  };
}

/**
 * 检查AI配置是否可用
 */
export async function checkAIConfig(config?: any): Promise<HealthCheckResult> {
  // 先快速检查配置是否存在
  const { exists, provider, model } = checkAIConfigExists(config);

  if (!exists) {
    return {
      success: false,
      message: '未配置AI服务',
      error: '请在设置中配置AI提供商和API密钥，或设置环境变量',
      provider,
      model
    };
  }

  // 解密 API Key（如果需要）
  let apiKey = config?.apiKey;
  if (apiKey) {
    const { safeDecrypt, isEncrypted } = await import('@/lib/crypto/encryption');
    if (isEncrypted(apiKey)) {
      apiKey = safeDecrypt(apiKey);
    }
  }

  const baseURL = config?.baseURL;

  try {
    // 创建AI服务实例
    const aiService = new AIService({
      provider: provider as 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'custom',
      model,
      apiKey,
      baseURL,
      maxTokens: 50,
      temperature: 0.1,
    });

    // 发送测试请求（带超时）
    const response = await withTimeout(
      aiService.chat({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Reply with a simple "OK".' },
          { role: 'user', content: 'Test' }
        ],
        max_tokens: 5,
        temperature: 0.1
      }),
      HEALTH_CHECK_TIMEOUT,
      `连接超时（${HEALTH_CHECK_TIMEOUT / 1000}秒），请检查网络连接或API地址是否正确`
    );

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
      errorMessage = 'API地址或模型名称不正确 (404)\n请检查：\n1. API Base URL 是否完整\n2. 模型名称是否在该平台上可用';
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
    } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = '网络连接失败，请检查网络设置和API地址';
    } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
      errorMessage = '模型不可用，请检查模型名称是否正确';
      isConfigError = true;
    } else if (errorMessage.includes('ENOTFOUND')) {
      errorMessage = '无法解析API地址，请检查 baseURL 是否正确';
      isConfigError = true;
    } else if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
      errorMessage = '连接超时，请检查网络连接或API地址是否正确';
    }

    return {
      success: false,
      message: isConfigError ? 'AI配置错误' : 'AI服务连接失败',
      error: errorMessage,
      provider,
      model
    };
  }
}

/**
 * 快速检查AI配置（不发送API请求，仅检查配置是否存在）
 */
export async function checkAIConfigQuick(config?: any): Promise<HealthCheckResult> {
  const { exists, provider, model } = checkAIConfigExists(config);

  if (!exists) {
    return {
      success: false,
      message: '未配置AI服务',
      error: '请在设置中配置AI提供商和API密钥',
      provider,
      model
    };
  }

  return {
    success: true,
    message: 'AI配置已就绪',
    provider,
    model
  };
}

/**
 * 获取用户的AI配置（解密API密钥）
 */
export async function getUserAIConfig(userId: string, db: any) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiConfig: true }
  });

  const aiConfig = user?.aiConfig as {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
  } | null;

  if (!aiConfig) {
    return null;
  }

  // 解密 API Key（如果已加密）
  if (aiConfig.apiKey) {
    const { safeDecrypt } = await import('@/lib/crypto/encryption');
    aiConfig.apiKey = safeDecrypt(aiConfig.apiKey);
  }

  return aiConfig;
}
