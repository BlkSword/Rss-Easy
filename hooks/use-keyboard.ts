/**
 * 键盘快捷键 hook
 * 为 RSS 阅读器提供键盘导航支持
 */

import { useEffect, useCallback, useRef } from 'react';

interface KeyBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboard(bindings: KeyBinding[], enabled = true) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 忽略在输入框中的快捷键
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    for (const binding of bindingsRef.current) {
      const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
      const ctrlMatch = binding.ctrl ? event.ctrlKey || event.metaKey : true;
      const shiftMatch = binding.shift ? event.shiftKey : true;
      const altMatch = binding.alt ? event.altKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        binding.handler();
        break;
      }
    }
  }, [enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 预定义的 RSS 阅读器快捷键
 */
export function useReaderShortcuts({
  onNext,
  onPrevious,
  onRefresh,
  onStar,
  onRead,
  onSearch,
  onAddFeed,
  onToggleSidebar,
}: {
  onNext?: () => void;
  onPrevious?: () => void;
  onRefresh?: () => void;
  onStar?: () => void;
  onRead?: () => void;
  onSearch?: () => void;
  onAddFeed?: () => void;
  onToggleSidebar?: () => void;
}) {
  const bindings: KeyBinding[] = [
    {
      key: 'j',
      handler: () => onNext?.(),
      description: '下一篇文章',
    },
    {
      key: 'k',
      handler: () => onPrevious?.(),
      description: '上一篇文章',
    },
    {
      key: 'r',
      handler: () => onRefresh?.(),
      description: '刷新',
    },
    {
      key: 's',
      handler: () => onStar?.(),
      description: '收藏/取消收藏',
    },
    {
      key: 'm',
      handler: () => onRead?.(),
      description: '标记已读/未读',
    },
    {
      key: '/',
      handler: () => onSearch?.(),
      description: '搜索',
    },
    {
      key: 'a',
      handler: () => onAddFeed?.(),
      description: '添加订阅源',
    },
    {
      key: 'b',
      ctrl: true,
      handler: () => onToggleSidebar?.(),
      description: '切换侧边栏',
    },
  ];

  useKeyboard(bindings);

  return bindings;
}

export default useKeyboard;
