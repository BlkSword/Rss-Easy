/**
 * AI 助手页面
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
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
        content: `这是对"${input}"的模拟响应。在实际部署中，这里会连接到 AI 服务来生成真实的响应。\n\n您可以询问：\n- 今天的文章摘要\n- 分析某个主题的趋势\n- 推荐值得阅读的文章\n- 整理特定分类的内容`,
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
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="container py-6 max-w-4xl">
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
      <div className="bg-card border rounded-lg min-h-[400px] max-h-[600px] overflow-y-auto p-4 mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">欢迎使用 AI 助手</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              我可以帮助您分析文章、生成摘要、发现趋势。请选择下方建议或输入您的问题。
            </p>

            {/* 建议 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.title}
                  onClick={() => handleSuggestion(suggestion.prompt)}
                  className="flex flex-col items-center gap-2 p-4 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-left"
                >
                  <div className="text-primary">{suggestion.icon}</div>
                  <div className="text-sm font-medium">{suggestion.title}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs opacity-60">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-primary-foreground font-medium">我</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-secondary rounded-lg px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入您的问题..."
          className="flex-1 px-4 py-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={() => setMessages([])}
          className="px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          title="清空对话"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* 提示信息 */}
      <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <p className="text-sm text-purple-700 dark:text-purple-300">
          💡 <strong>提示：</strong>AI 助手可以帮助您分析文章、生成摘要、发现趋势。回答基于您订阅的文章内容。
        </p>
      </div>
    </div>
  );
}
