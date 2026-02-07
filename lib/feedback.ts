/**
 * 全局反馈工具函数
 * 统一使用自定义 Toast 组件
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

// 全局 toast 回调函数类型
type ToastCallback = (toast: { type: ToastType; title: string; message?: string }) => void;

// 全局 toast 回调（在 ToastProvider 中设置）
let globalAddToast: ToastCallback | null = null;

/**
 * 设置全局 toast 回调
 */
export function setGlobalToast(callback: ToastCallback) {
  globalAddToast = callback;
}

/**
 * 显示 toast 通知
 */
function showToast(type: ToastType, title: string, message?: string) {
  if (globalAddToast) {
    globalAddToast({ type, title, message });
  } else {
    console.warn('Toast provider not initialized, falling back to console:', type, title, message);
  }
}

/**
 * 显示成功通知
 */
export function notifySuccess(title: string, message?: string) {
  return showToast('success', title, message);
}

/**
 * 显示错误通知
 */
export function notifyError(title: string, message?: string) {
  return showToast('error', title, message);
}

/**
 * 显示信息通知
 */
export function notifyInfo(title: string, message?: string) {
  return showToast('info', title, message);
}

/**
 * 显示警告通知
 */
export function notifyWarning(title: string, message?: string) {
  return showToast('warning', title, message);
}

/**
 * API 错误处理辅助函数
 */
export function handleApiError(error: unknown, context = '操作失败') {
  console.error(`${context}:`, error);

  let errorMessage = `${context}，请稍后重试`;

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = (error as { message: string }).message;
  }

  notifyError(context, errorMessage);
  return errorMessage;
}

/**
 * API 成功处理辅助函数
 */
export function handleApiSuccess(title: string, message?: string) {
  return notifySuccess(title, message);
}
