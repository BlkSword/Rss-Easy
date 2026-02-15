/**
 * 系统日志记录器
 * 用于记录应用运行时的各种日志信息
 */

import { db } from './db';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LogCategory = 'system' | 'rss' | 'ai' | 'auth' | 'email' | 'api' | 'queue' | 'security';

interface LogOptions {
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  error?: Error;
  errorCode?: string;
  duration?: number;
  memory?: number;
  source?: string;
  tags?: string[];
}

/**
 * 写入日志到数据库
 */
export async function log(options: LogOptions) {
  try {
    const {
      level,
      category,
      message,
      details,
      userId,
      requestId,
      ipAddress,
      userAgent,
      error,
      errorCode,
      duration,
      memory,
      source,
      tags,
    } = options;

    await db.systemLog.create({
      data: {
        level,
        category,
        message,
        details: details || {},
        userId,
        requestId,
        ipAddress,
        userAgent,
        stackTrace: error?.stack,
        errorCode,
        duration,
        memory,
        source,
        tags: tags || [],
      },
    });
  } catch (e) {
    // 如果日志写入失败，输出到控制台
    console.error('Failed to write log:', e);
    console.error('Original log:', options);
  }
}

/**
 * 快捷方法：调试日志
 */
export function debug(category: LogCategory, message: string, details?: Record<string, any>, userId?: string) {
  return log({ level: 'debug', category, message, details, userId });
}

/**
 * 快捷方法：信息日志
 */
export function info(category: LogCategory, message: string, details?: Record<string, any>, userId?: string) {
  return log({ level: 'info', category, message, details, userId });
}

/**
 * 快捷方法：警告日志
 */
export function warn(category: LogCategory, message: string, details?: Record<string, any>, userId?: string) {
  return log({ level: 'warn', category, message, details, userId });
}

/**
 * 快捷方法：错误日志
 */
export function error(
  category: LogCategory,
  message: string,
  errorObj?: Error,
  details?: Record<string, any>,
  userId?: string
) {
  return log({
    level: 'error',
    category,
    message,
    error: errorObj,
    details,
    userId,
  });
}

/**
 * 快捷方法：致命错误日志
 */
export function fatal(
  category: LogCategory,
  message: string,
  errorObj?: Error,
  details?: Record<string, any>,
  userId?: string
) {
  return log({
    level: 'fatal',
    category,
    message,
    error: errorObj,
    details,
    userId,
  });
}

/**
 * 创建带上下文的日志记录器
 */
export function createLogger(context: {
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
}) {
  return {
    debug: (category: LogCategory, message: string, details?: Record<string, any>) =>
      log({ level: 'debug', category, message, details, ...context }),
    info: (category: LogCategory, message: string, details?: Record<string, any>) =>
      log({ level: 'info', category, message, details, ...context }),
    warn: (category: LogCategory, message: string, details?: Record<string, any>) =>
      log({ level: 'warn', category, message, details, ...context }),
    error: (category: LogCategory, message: string, errorObj?: Error, details?: Record<string, any>) =>
      log({ level: 'error', category, message, error: errorObj, details, ...context }),
    fatal: (category: LogCategory, message: string, errorObj?: Error, details?: Record<string, any>) =>
      log({ level: 'fatal', category, message, error: errorObj, details, ...context }),
  };
}

export default { log, debug, info, warn, error, fatal, createLogger };
