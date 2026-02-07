'use client';

import { useRouter } from 'next/navigation';
import {
  Keyboard,
  ArrowDown,
  ArrowUp,
  Star,
  Check,
  Search,
  Plus,
  RefreshCw,
  ArrowLeft,
  X,
  Command,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PageTransition } from '@/components/animation/fade';
import { cn } from '@/lib/utils';

interface ShortcutItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  modifier?: 'cmd' | 'shift' | 'alt';
}

const navigationShortcuts: ShortcutItem[] = [
  { key: 'J', label: '下一篇文章', icon: <ArrowDown className="h-4 w-4" /> },
  { key: 'K', label: '上一篇文章', icon: <ArrowUp className="h-4 w-4" /> },
  { key: '←', label: '返回', icon: <ArrowLeft className="h-4 w-4" /> },
  { key: 'ESC', label: '关闭/取消', icon: <X className="h-4 w-4" /> },
];

const actionShortcuts: ShortcutItem[] = [
  { key: 'S', label: '收藏/取消收藏', icon: <Star className="h-4 w-4" /> },
  { key: 'M', label: '标记已读/未读', icon: <Check className="h-4 w-4" /> },
  { key: 'R', label: '刷新', icon: <RefreshCw className="h-4 w-4" /> },
  { key: 'A', label: '添加订阅', icon: <Plus className="h-4 w-4" /> },
];

const globalShortcuts: ShortcutItem[] = [
  {
    key: 'K',
    label: '搜索',
    icon: <Search className="h-4 w-4" />,
    modifier: 'cmd',
    description: '快速搜索文章',
  },
  {
    key: 'B',
    label: '切换侧边栏',
    modifier: 'cmd',
    description: '显示/隐藏侧边栏',
  },
  {
    key: '?',
    label: '快捷键帮助',
    description: '打开此页面',
  },
];

function ShortcutGroup({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: ShortcutItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key + shortcut.label}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                {shortcut.icon && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    {shortcut.icon}
                  </div>
                )}
                <div>
                  <p className="font-medium">{shortcut.label}</p>
                  {shortcut.description && (
                    <p className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {shortcut.modifier && (
                  <kbd
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-mono font-medium bg-muted',
                      'border border-border/60'
                    )}
                  >
                    {shortcut.modifier === 'cmd' ? (
                      <Command className="h-3 w-3" />
                    ) : (
                      shortcut.modifier
                    )}
                  </kbd>
                )}
                <kbd
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-mono font-medium',
                    'bg-primary/10 text-primary border border-primary/20'
                  )}
                >
                  {shortcut.key}
                </kbd>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShortcutsPage() {
  const router = useRouter();

  return (
    <PageTransition className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Keyboard className="h-6 w-6 text-primary" />
              键盘快捷键
            </h1>
            <p className="text-muted-foreground mt-1">
              使用键盘快捷键可以更高效地使用 Rss-Easy
            </p>
          </div>
        </div>

        {/* 快捷键列表 */}
        <div className="space-y-6">
          <ShortcutGroup
            title="全局快捷键"
            shortcuts={globalShortcuts}
          />
          <ShortcutGroup
            title="导航快捷键"
            shortcuts={navigationShortcuts}
          />
          <ShortcutGroup
            title="操作快捷键"
            shortcuts={actionShortcuts}
          />
        </div>

        {/* 提示 */}
        <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border/60">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">提示：</strong>
            在输入框中输入时，快捷键会被暂时禁用，以避免与文本输入冲突。
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
