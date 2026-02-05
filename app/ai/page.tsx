/**
 * AI 助手页面 - 全屏布局
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Copy,
  RefreshCw,
  Lightbulb,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { Button, Card, Input, Space, message, Avatar, Typography, Tooltip } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { useSidebar } from '@/components/providers/sidebar-provider';
import { cn } from '@/lib/utils';

const { TextArea } = Input;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type Suggestion = {
  icon: React.ReactNode;
  title: string;
  prompt: string;
};

const suggestions: Suggestion[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    title: '生成今日摘要',
    prompt: '请帮我生成今天的重要文章摘要，按主题分类',
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: '分析趋势',
    prompt: '分析最近一周的文章趋势，找出热门话题',
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: '推荐阅读',
    prompt: '根据我的阅读历史，推荐今天值得阅读的文章',
  },
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isCollapsed, toggleSidebar } = useSidebar();

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
    setInput('');
    setIsLoading(true);

    // 模拟 AI 响应
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `这是对"${userMessage.content}"的模拟响应。在实际部署中，这里会连接到 AI 服务来生成真实的响应。\n\n您可以询问：\n- 今天的文章摘要\n- 分析某个主题的趋势\n- 推荐值得阅读的文章\n- 整理特定分类的内容`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const clearMessages = () => {
    setMessages([]);
    message.success('对话已清空');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isCollapsed ? 'hidden lg:hidden' : 'block'
        )}>
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-4xl mx-auto px-6 py-8 h-full flex flex-col">
            {/* 头部 */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-500" />
                AI 助手
              </h1>
              <p className="text-muted-foreground">
                智能分析您的文章，提供摘要、趋势分析和个性化推荐
              </p>
            </div>

            {/* 消息列表 */}
            <Card className="flex-1 flex flex-col min-h-0 mb-4 border-border/60">
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-purple-500" />
                    </div>
                    <Typography.Title level={3} className="mb-2">欢迎使用 AI 助手</Typography.Title>
                    <Typography.Text className="text-muted-foreground mb-6 block">
                      我可以帮助您分析文章、生成摘要、发现趋势。请选择下方建议或输入您的问题。
                    </Typography.Text>

                    {/* 建议 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
                      {suggestions.map((suggestion) => (
                        <Button
                          key={suggestion.title}
                          onClick={() => handleSuggestion(suggestion.prompt)}
                          className="flex flex-col items-center gap-2 p-4 h-auto"
                        >
                          <div className="text-primary">{suggestion.icon}</div>
                          <div className="text-sm font-medium">{suggestion.title}</div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <Space direction="vertical" size="middle" className="w-full">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {msg.role === 'assistant' && (
                            <Avatar
                              icon={<Sparkles className="h-4 w-4" />}
                              className="bg-gradient-to-br from-purple-500 to-pink-500"
                            />
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary'
                            }`}
                          >
                            <Typography.Text
                              className={`whitespace-pre-wrap text-sm ${
                                msg.role === 'user' ? 'text-primary-foreground' : ''
                              }`}
                            >
                              {msg.content}
                            </Typography.Text>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs opacity-60">
                                {msg.timestamp.toLocaleTimeString()}
                              </span>
                              {msg.role === 'assistant' && (
                                <Tooltip title="复制">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<Copy className="h-3 w-3" />}
                                    onClick={() => copyMessage(msg.content)}
                                    className="h-auto p-1"
                                  />
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          {msg.role === 'user' && (
                            <Avatar className="bg-primary">
                              <span className="text-xs text-primary-foreground font-medium">我</span>
                            </Avatar>
                          )}
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-3 justify-start">
                          <Avatar
                            icon={<Sparkles className="h-4 w-4" />}
                            className="bg-gradient-to-br from-purple-500 to-pink-500"
                          />
                          <div className="bg-secondary rounded-lg px-4 py-3">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </Space>
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </Card>

            {/* 输入框 */}
            <Space.Compact className="w-full">
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入您的问题... (Shift+Enter 换行)"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={isLoading}
              />
              <Button
                type="primary"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                icon={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              >
                发送
              </Button>
              <Tooltip title="清空对话">
                <Button
                  onClick={clearMessages}
                  icon={<RefreshCw className="h-5 w-5" />}
                />
              </Tooltip>
            </Space.Compact>

            {/* 提示信息 */}
            <Card className="mt-4 bg-purple-500/10 border-purple-500/20" size="small">
              <Typography.Text className="text-purple-700 dark:text-purple-300 text-sm">
                💡 <strong>提示：</strong>AI 助手可以帮助您分析文章、生成摘要、发现趋势。回答基于您订阅的文章内容。
              </Typography.Text>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
