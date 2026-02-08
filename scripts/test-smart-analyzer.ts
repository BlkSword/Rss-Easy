/**
 * 智能分析器性能测试
 *
 * 对比 SmartAnalyzer 与 SegmentedAnalyzer 的性能
 */

import { createSmartAnalyzer, SmartAnalyzer } from '../lib/ai/smart-analyzer';
import { SegmentedAnalyzer } from '../lib/ai/analysis/segmented-analyzer';
import { db } from '@/lib/db';

// =====================================================
// 测试数据
// =====================================================

const TEST_ARTICLES = {
  short: {
    title: 'TypeScript 基础',
    content: `TypeScript 是 JavaScript 的超集。
它添加了静态类型检查，使代码更加安全。
在开发过程中，TypeScript 可以帮助提前发现错误。
建议在大型项目中使用 TypeScript。`,
    length: 106,
    category: 'short',
  },
  medium: {
    title: 'React 性能优化技巧',
    content: `React 性能优化是前端开发中的重要话题。
以下是几个实用的优化技巧：

1. 使用 useMemo 缓存计算结果
2. 使用 useCallback 缓存回调函数
3. 使用 React.memo 避免不必要的重渲染
4. 合理使用 useEffect 的依赖项
5. 避免在渲染中创建新对象

这些技巧可以显著提升应用的性能。
在实际项目中，应该根据具体情况选择合适的优化策略。
记住，过早优化是万恶之源，先确保代码正确，再考虑优化。` +
    `React 的性能优化还有很多其他方面，比如代码分割、懒加载等。
持续学习和实践是提高性能优化能力的关键。`.repeat(5),
    length: 650,
    category: 'medium',
  },
  long: {
    title: '深入理解 Node.js 事件循环',
    content: `Node.js 的事件循环是其核心特性之一。
理解事件循环对于编写高效的异步代码至关重要。

首先，我们需要了解 Node.js 的单线程模型。
虽然 JavaScript 是单线程的，但 Node.js 通过事件循环实现了非阻塞 I/O。
这意味着 Node.js 可以同时处理多个操作，而不会阻塞主线程。

事件循环有多个阶段，每个阶段都有不同的任务队列：
1. Timers 阶段
2. Pending callbacks 阶段
3. Idle/prepare 阶段
4. Poll 阶段
5. Check 阶段
6. Close callbacks 阶段

每个阶段都会执行特定类型的回调函数。
理解这些阶段有助于我们编写更高效的异步代码。

微任务队列（Microtask Queue）也是事件循环的重要组成部分。
Promise 的回调、queueMicrotask 等都会进入微任务队列。
微任务会在每个宏任务完成后立即执行。

在实际开发中，我们应该注意避免阻塞事件循环。
长时间运行的计算会阻塞事件循环，导致应用响应变慢。
可以使用 Worker Threads 或将任务分解为小块来处理。

setImmediate 和 process.nextTick 也是常用的异步工具。
它们在不同的时机执行，理解它们的区别很重要。`.repeat(30),
    length: 3500,
    category: 'long',
  },
};

// =====================================================
// 测试函数
// =====================================================

/**
 * 创建模拟 LLM 服务
 */
function createMockLLM() {
  let callCount = 0;

  return {
    chat: async (messages: any[]) => {
      callCount++;
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 100));

      const userMessage = messages[messages.length - 1]?.content || '';

      return {
        content: JSON.stringify({
          oneLineSummary: '模拟分析的摘要',
          summary: userMessage.slice(0, 200),
          mainPoints: ['要点1', '要点2', '要点3'],
          tags: ['标签1', '标签2'],
          domain: '技术',
          subcategory: '编程',
          aiScore: 8,
          scoreDimensions: {
            depth: 7,
            quality: 8,
            practicality: 9,
            novelty: 6,
          },
        }),
        usage: {
          promptTokens: userMessage.length,
          completionTokens: 200,
        },
      };
    },
  };
}

/**
 * 测试智能分析器
 */
async function testSmartAnalyzer() {
  console.log('\n🧪 测试智能分析器\n');

  const llm = createMockLLM();
  const smartAnalyzer = new SmartAnalyzer(llm as any);

  for (const [key, article] of Object.entries(TEST_ARTICLES)) {
    console.log(`\n📄 测试 ${article.category} 文章: ${article.title}`);
    console.log(`   长度: ${article.length} 字符`);

    const start = Date.now();
    const result = await smartAnalyzer.analyze(article.content, {
      title: article.title,
    });
    const elapsed = Date.now() - start;

    console.log(`   耗时: ${elapsed}ms`);
    console.log(`   评分: ${result.aiScore}/10`);
    console.log(`   要点数: ${result.mainPoints?.length || 0}`);
    console.log(`   标签数: ${result.tags?.length || 0}`);
  }
}

/**
 * 性能对比测试
 */
async function comparePerformance() {
  console.log('\n🔬 性能对比测试\n');

  const llm = createMockLLM();
  const smartAnalyzer = new SmartAnalyzer(llm as any);
  const segmentedAnalyzer = new SegmentedAnalyzer(llm as any);

  const results: Record<string, {
    smart: number;
    segmented: number;
    improvement: string;
  }> = {};

  for (const [key, article] of Object.entries(TEST_ARTICLES)) {
    console.log(`📄 ${article.category}: ${article.title}`);

    // 测试智能分析器
    const smartStart = Date.now();
    await smartAnalyzer.analyze(article.content, { title: article.title });
    const smartTime = Date.now() - smartStart;

    // 测试分段分析器
    const segStart = Date.now();
    await segmentedAnalyzer.analyze(article.content, { title: article.title });
    const segTime = Date.now() - segStart;

    // 计算改进
    const improvement = ((1 - smartTime / segTime) * 100).toFixed(1);

    results[key] = {
      smart: smartTime,
      segmented: segTime,
      improvement: improvement + '%',
    };

    console.log(`  SmartAnalyzer: ${smartTime}ms`);
    console.log(`  SegmentedAnalyzer: ${segTime}ms`);
    console.log(`  改进: ${improvement}%\n`);
  }

  console.log('📊 总结:');
  console.log(`  短文章改进: ${results.short.improvement}`);
  console.log(`  中文文章改进: ${results.medium.improvement}`);
  console.log(`  长文章改进: ${results.long.improvement}`);
}

/**
 * 测试真实文章
 */
async function testRealArticles() {
  console.log('\n🧪 测试真实文章\n');

  // 获取测试文章
  const entries = await db.entry.findMany({
    where: {
      content: { not: null },
      aiAnalyzedAt: null,
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
    take: 3,
  });

  if (entries.length === 0) {
    console.log('没有找到未分析的文章');
    return;
  }

  console.log(`找到 ${entries.length} 篇文章\n`);

  const llm = createMockLLM();
  const smartAnalyzer = new SmartAnalyzer(llm as any);

  for (const entry of entries) {
    const content = entry.content || '';
    const length = content.length;

    console.log(`📄 ${entry.title}`);
    console.log(`   长度: ${length} 字符`);

    let category: string;
    if (length <= 6000) category = '短文';
    else if (length <= 12000) category = '中文';
    else category = '长文';

    console.log(`   分类: ${category}`);

    const start = Date.now();
    try {
      const result = await smartAnalyzer.analyze(content, {
        title: entry.title,
      });
      const elapsed = Date.now() - start;

      console.log(`   耗时: ${elapsed}ms`);
      console.log(`   评分: ${result.aiScore}/10`);
      console.log(`   要点数: ${result.mainPoints?.length || 0}\n`);
    } catch (error) {
      console.log(`   分析失败: ${error}\n`);
    }
  }
}

// =====================================================
// 主函数
// =====================================================

async function main() {
  console.log('==========================================');
  console.log('  智能分析器测试');
  console.log('==========================================');

  try {
    // 基础测试
    await testSmartAnalyzer();

    // 性能对比
    await comparePerformance();

    // 真实文章测试
    await testRealArticles();

    console.log('\n==========================================');
    console.log('  ✅ 所有测试完成');
    console.log('==========================================\n');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
