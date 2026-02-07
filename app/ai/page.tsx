/**
 * AI 助手页面 - 全屏布局（增强版动画）
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Copy,
  RefreshCw,
  Lightbulb,
  FileText,
  TrendingUp,
  User,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button, Card, Input, Avatar, Typography, Tooltip, Modal } from 'antd';
import { useToast } from '@/components/ui/toast';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { Fade, HoverLift } from '@/components/animation/fade';
import { Typewriter, LoadingDots } from '@/components/animation';
import { usePageLoadAnimation, useTypewriter } from '@/hooks/use-animation';

const { TextArea } = Input;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
};

type Suggestion = {
  icon: React.ReactNode;
  title: string;
  prompt: string;
  color: string;
};

const suggestions: Suggestion[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    title: '生成今日摘要',
    prompt: '请帮我生成今天的重要文章摘要，按主题分类',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: '分析趋势',
    prompt: '分析最近一周的文章趋势，找出热门话题',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: '推荐阅读',
    prompt: '根据我的阅读历史，推荐今天值得阅读的文章',
    color: 'from-amber-500 to-orange-500',
  },
];

// 打字机效果的消息内容组件
function TypewriterMessage({
  content,
  onComplete,
}: {
  content: string;
  onComplete?: () => void;
}) {
  const { displayText, isComplete } = useTypewriter(content, 15, 100);

  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  return (
    <span className="whitespace-pre-wrap">
      {displayText}
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

// 用户头像组件（带动画）
function UserAvatar() {
  const [isPulsing, setIsPulsing] = useState(false);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-lg transition-all duration-300',
        isPulsing && 'scale-110 shadow-primary/30'
      )}
      onMouseEnter={() => setIsPulsing(true)}
      onMouseLeave={() => setIsPulsing(false)}
    >
      <User className="h-4 w-4 text-primary-foreground" />
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-0 group-hover:opacity-100" />
    </div>
  );
}

// AI 头像组件（带动画）
function AIAvatar({ isThinking = false }: { isThinking?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg transition-all duration-500',
        isThinking && 'shadow-purple-500/30 scale-105'
      )}
    >
      <Sparkles
        className={cn(
          'h-4 w-4 text-white transition-all duration-300',
          isThinking && 'animate-pulse'
        )}
      />
      {/* 光晕效果 */}
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-0 blur-md transition-opacity duration-500',
          isThinking && 'opacity-50 animate-pulse'
        )}
      />
      {/* 思考时的旋转光环 */}
      {isThinking && (
        <div className="absolute -inset-1 rounded-full border-2 border-purple-400/30 border-t-purple-500 animate-spin" />
      )}
    </div>
  );
}

// 消息气泡组件
function MessageBubble({
  message,
  index,
  onCopy,
}: {
  message: Message;
  index: number;
  onCopy: (content: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <Fade
      in
      direction={isUser ? 'left' : 'right'}
      distance={20}
      duration={400}
      delay={index * 50}
    >
      <div
        className={cn(
          'flex gap-3 mb-4 group',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        {/* 头像 */}
        {isUser ? <UserAvatar /> : <AIAvatar isThinking={false} />}

        {/* 消息内容 */}
        <div
          className={cn(
            'relative max-w-[80%] px-4 py-3 rounded-2xl shadow-sm transition-all duration-300 group-hover:shadow-md',
            isUser
              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
              : 'bg-gradient-to-br from-muted/80 to-muted rounded-bl-md'
          )}
        >
          {/* 消息文本 */}
          <div
            className={cn(
              'text-sm leading-relaxed',
              isUser ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {message.isTyping ? (
              <TypewriterMessage
                content={message.content}
                onComplete={() => {
                  message.isTyping = false;
                }}
              />
            ) : (
              <span className="whitespace-pre-wrap">{message.content}</span>
            )}
          </div>

          {/* 时间戳和操作 */}
          <div
            className={cn(
              'flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              isUser ? 'justify-start' : 'justify-end'
            )}
          >
            <span
              className={cn(
                'text-[10px]',
                isUser
                  ? 'text-primary-foreground/60'
                  : 'text-muted-foreground'
              )}
            >
              {message.timestamp.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>

            {!isUser && (
              <Tooltip title="复制内容">
                <button
                  onClick={() => onCopy(message.content)}
                  className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* 装饰性小三角 */}
          <div
            className={cn(
              'absolute top-3 w-2 h-2 transform rotate-45',
              isUser
                ? '-right-1 bg-primary'
                : '-left-1 bg-muted/80'
            )}
          />
        </div>
      </div>
    </Fade>
  );
}

// 加载状态消息组件
function LoadingMessage() {
  return (
    <Fade in direction="right" distance={20} duration={300}>
      <div className="flex gap-3 mb-4">
        <AIAvatar isThinking={true} />
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-muted/80 to-muted rounded-bl-md shadow-sm">
          <LoadingDots size="sm" className="text-purple-500" />
          <span className="text-xs text-muted-foreground">AI 正在思考...</span>
        </div>
      </div>
    </Fade>
  );
}

// 建议卡片组件
function SuggestionCard({
  suggestion,
  index,
  onClick,
}: {
  suggestion: Suggestion;
  index: number;
  onClick: () => void;
}) {
  return (
    <Fade in direction="up" distance={15} duration={400} delay={200 + index * 100}>
      <HoverLift lift={6} shadow={true}>
        <button
          onClick={onClick}
          className={cn(
            'w-full flex flex-col items-center gap-3 p-5 rounded-xl',
            'bg-gradient-to-br from-card to-card/95',
            'border border-border/50 hover:border-purple-500/30',
            'transition-all duration-300',
            'group'
          )}
        >
          {/* 图标容器 */}
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl',
              'bg-gradient-to-br shadow-md',
              'transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
              suggestion.color
            )}
          >
            <div className="text-white">{suggestion.icon}</div>
          </div>

          {/* 标题 */}
          <span className="text-sm font-medium text-foreground group-hover:text-purple-500 transition-colors">
            {suggestion.title}
          </span>
        </button>
      </HoverLift>
    </Fade>
  );
}

// 空状态组件
function EmptyState({ onSuggestion }: { onSuggestion: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      {/* 主图标动画 */}
      <Fade in direction="up" distance={30} duration={600} delay={100}>
        <div className="relative mb-6">
          {/* 外圈光环 */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-xl animate-pulse" />
          {/* 主图标 */}
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl transform transition-transform duration-500 hover:scale-105 hover:rotate-3">
            <Sparkles className="h-10 w-10 text-white animate-pulse" />
          </div>
          {/* 装饰点 */}
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-400 animate-ping" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-pink-400 animate-ping delay-300" />
        </div>
      </Fade>

      {/* 标题 */}
      <Fade in direction="up" distance={20} duration={500} delay={200}>
        <Typography.Title level={3} className="mb-2">
          欢迎使用 AI 助手
        </Typography.Title>
      </Fade>

      {/* 描述 */}
      <Fade in direction="up" distance={20} duration={500} delay={300}>
        <Typography.Text className="text-muted-foreground mb-8 block max-w-md">
          我可以帮助您分析文章、生成摘要、发现趋势。
          <br />
          请选择下方建议或输入您的问题。
        </Typography.Text>
      </Fade>

      {/* 建议卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl px-4">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.title}
            suggestion={suggestion}
            index={index}
            onClick={() => onSuggestion(suggestion.prompt)}
          />
        ))}
      </div>
    </div>
  );
}

// 输入框组件
function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onClear,
  hasMessages,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onClear: () => void;
  hasMessages: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full">
      {/* 输入区域 */}
      <div
        className={cn(
          'relative flex items-end gap-2 p-2 rounded-2xl',
          'bg-gradient-to-br from-card to-card/95',
          'border-2 transition-all duration-300',
          isFocused
            ? 'border-purple-500/50 shadow-lg shadow-purple-500/10'
            : 'border-border/50 hover:border-border'
        )}
      >
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="输入您的问题... (Shift+Enter 换行)"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={isLoading}
          className="flex-1 border-0 bg-transparent focus:ring-0 resize-none py-2 px-3 text-sm"
        />

        {/* 按钮组 */}
        <div className="flex items-center gap-1 pb-1">
          {/* 清空按钮 - 仅在有消息时显示 */}
          {hasMessages && (
            <Tooltip title="清空对话">
              <button
                onClick={onClear}
                disabled={isLoading}
                className={cn(
                  'p-2.5 rounded-xl transition-all duration-200',
                  'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
          )}

          {/* 发送按钮 */}
          <Tooltip title={isLoading ? 'AI 正在回复...' : '发送消息'}>
            <button
              onClick={onSend}
              disabled={!value.trim() || isLoading}
              className={cn(
                'p-2.5 rounded-xl transition-all duration-200',
                'bg-gradient-to-r from-purple-500 to-pink-500',
                'text-white shadow-md',
                'hover:shadow-lg hover:shadow-purple-500/25 hover:scale-105',
                'active:scale-95',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// 清空确认弹窗
function ClearConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      closable={false}
      width={400}
      className="clear-confirm-modal"
    >
      <div className="flex flex-col items-center text-center py-4">
        {/* 警告图标 */}
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-lg animate-pulse" />
          <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <AlertTriangle className="h-7 w-7 text-white" />
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-2">清空对话</h3>
        <p className="text-sm text-muted-foreground mb-6">
          确定要清空所有对话消息吗？此操作不可撤销。
        </p>

        <div className="flex gap-3 w-full">
          <Button
            onClick={onCancel}
            className="flex-1 h-10"
          >
            取消
          </Button>
          <Button
            type="primary"
            danger
            onClick={onConfirm}
            className="flex-1 h-10"
          >
            确认清空
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// 主页面组件
export default function AIPage() {
  const { addToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // tRPC mutations
  const aiChat = trpc.ai.chat.useMutation();

  // 页面加载动画
  const isPageLoaded = usePageLoadAnimation(100);

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiChat.mutateAsync({
        messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        isTyping: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      addToast({
        type: 'error',
        title: '发送失败',
        message: error instanceof Error ? error.message : '请稍后重试',
      });
      // 如果出错，回退输入框内容
      setInput(currentInput);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    // 自动聚焦输入框
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    }, 100);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        addToast({ type: 'success', title: '已复制到剪贴板' });
      })
      .catch(() => {
        addToast({ type: 'error', title: '复制失败' });
      });
  };

  const openClearModal = () => {
    setIsClearModalOpen(true);
  };

  const closeClearModal = () => {
    setIsClearModalOpen(false);
  };

  const confirmClear = () => {
    setMessages([]);
    setIsClearModalOpen(false);
    addToast({ type: 'success', title: '对话已清空' });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader
        onToggleSidebar={toggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
          )}
        >
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 h-full flex flex-col">
            {/* 头部 */}
            <Fade
              in={isPageLoaded}
              direction="down"
              distance={15}
              duration={500}
            >
              <div className="mb-4">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <div className="relative">
                    <Sparkles className="h-7 w-7 text-purple-500" />
                    <div className="absolute inset-0 blur-lg bg-purple-500/30 rounded-full" />
                  </div>
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    AI 助手
                  </span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  智能分析您的文章，提供摘要、趋势分析和个性化推荐
                </p>
              </div>
            </Fade>

            {/* 消息列表区域 */}
            <Card
              className="flex-1 flex flex-col min-h-0 mb-4 border-border/60 bg-gradient-to-b from-card/50 to-card shadow-sm"
              bodyStyle={{ padding: 0, height: '100%' }}
            >
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {messages.length === 0 ? (
                  <EmptyState onSuggestion={handleSuggestion} />
                ) : (
                  <>
                    {messages.map((msg, index) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        index={index}
                        onCopy={copyMessage}
                      />
                    ))}
                    {isLoading && <LoadingMessage />}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </Card>

            {/* 输入区域 */}
            <Fade
              in={isPageLoaded}
              direction="up"
              distance={10}
              duration={500}
              delay={200}
            >
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                isLoading={isLoading}
                onClear={openClearModal}
                hasMessages={messages.length > 0}
              />
            </Fade>

            {/* 提示信息 */}
            <Fade
              in={isPageLoaded}
              direction="up"
              distance={10}
              duration={500}
              delay={300}
            >
              <Card
                className="mt-4 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-pink-500/10 border-purple-500/20"
                size="small"
              >
                <Typography.Text className="text-purple-700 dark:text-purple-300 text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  <span>
                    <strong>提示：</strong>AI
                    助手可以帮助您分析文章、生成摘要、发现趋势。回答基于您订阅的文章内容。
                  </span>
                </Typography.Text>
              </Card>
            </Fade>
          </div>
        </main>
      </div>

      {/* 清空确认弹窗 */}
      <ClearConfirmModal
        open={isClearModalOpen}
        onCancel={closeClearModal}
        onConfirm={confirmClear}
      />
    </div>
  );
}
