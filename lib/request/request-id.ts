/**
 * 请求 ID 追踪
 * 为每个请求生成唯一 ID，用于日志追踪和审计
 */

import { randomUUID } from 'crypto';

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * 从请求头中提取请求 ID
 */
export function getRequestIdFromHeaders(headers: Headers): string {
  const requestId = headers.get('x-request-id') ||
                   headers.get('x-amzn-request-id') ||
                   headers.get('x-correlation-id');

  return requestId || generateRequestId();
}

/**
 * 请求上下文
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  timestamp: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * 创建请求上下文
 */
export function createRequestContext(
  request: Request,
  userId?: string
): RequestContext {
  const headers = request.headers as any;
  const url = new URL(request.url);

  return {
    requestId: getRequestIdFromHeaders(request.headers),
    userId,
    timestamp: Date.now(),
    method: request.method,
    path: url.pathname,
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         headers.get('x-real-ip') ||
         'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
  };
}

/**
 * 请求 ID 中间件（Next.js）
 */
export function addRequestIdToHeaders(requestId: string): HeadersInit {
  return {
    'x-request-id': requestId,
  };
}
