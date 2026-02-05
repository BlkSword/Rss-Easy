/**
 * 全局反馈工具函数
 * 使用 Ant Design 的 Notification 和 Message
 */
import { notification, message } from 'antd';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';
export type MessageType = 'success' | 'info' | 'warning' | 'error' | 'loading';

/**
 * 显示通知提醒框
 */
export function showNotification(
  type: NotificationType,
  title: string,
  description?: string,
  duration = 4.5
) {
  return notification[type]({
    message: title,
    description,
    duration,
    placement: 'topRight',
    style: {
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    },
  });
}

/**
 * 显示成功通知
 */
export function notifySuccess(title: string, description?: string) {
  return showNotification('success', title, description);
}

/**
 * 显示错误通知
 */
export function notifyError(title: string, description?: string) {
  return showNotification('error', title, description);
}

/**
 * 显示信息通知
 */
export function notifyInfo(title: string, description?: string) {
  return showNotification('info', title, description);
}

/**
 * 显示警告通知
 */
export function notifyWarning(title: string, description?: string) {
  return showNotification('warning', title, description);
}

/**
 * 显示消息提示
 */
export function showMessage(type: MessageType, content: string, duration = 3) {
  return message[type](content, duration);
}

/**
 * 显示成功消息
 */
export function messageSuccess(content: string) {
  return showMessage('success', content);
}

/**
 * 显示错误消息
 */
export function messageError(content: string) {
  return showMessage('error', content);
}

/**
 * 显示信息消息
 */
export function messageInfo(content: string) {
  return showMessage('info', content);
}

/**
 * 显示警告消息
 */
export function messageWarning(content: string) {
  return showMessage('warning', content);
}

/**
 * 显示加载消息
 */
export function messageLoading(content: string) {
  return showMessage('loading', content, 0);
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
export function handleApiSuccess(message: string, description?: string) {
  return notifySuccess(message, description);
}
