/**
 * 初评功能测试脚本
 *
 * 测试初评评估器的各项功能
 */

import { createPreliminaryEvaluator } from '../lib/ai/preliminary-evaluator';
import { createModelSelector } from '../lib/ai/model-selector';
import { db } from '../lib/db';

// =====================================================
// 测试数据
// =====================================================

const TEST_ARTICLES = {
  chinese: {
    title: '深入理解 React Server Components',
    content: `React Server Components 是 React 18 引入的一个重要特性。
它允许组件在服务器上渲染，从而减少客户端的 JavaScript 包大小。
本文将深入探讨 Server Components 的工作原理、使用场景和最佳实践。

首先，我们需要理解传统 React 应用的局限性。
然后，我们将介绍 Server Components 如何解决这些问题。
最后，我们将通过实际示例展示如何在项目中使用 Server Components。

这是一个技术性很强的话题，适合有 React 基础的开发者阅读。`,
  },
  english: {
    title: 'Understanding AI-Powered Code Generation',
    content: `AI-powered code generation is transforming how developers work.
Tools like GitHub Copilot and ChatGPT are becoming indispensable
for modern software development.

This article explores the current state of AI code generation,
its limitations, and future possibilities. We'll examine:

1. How AI models understand code
2. Best practices for AI-assisted development
3. Security considerations
4. The future of programming

Whether you're a seasoned developer or just starting out,
understanding these tools is essential for your career.`,
  },
  short: {
    title: 'Quick Tip: Use TypeScript',
    content: `TypeScript helps catch errors early.
It provides better IDE support and makes code more maintainable.
Start using it today!`,
  },
};

// =====================================================
// 测试函数
// =====================================================

/**
 * 测试初评评估器
 */
async function testPreliminaryEvaluator() {
  console.log('\n🧪 测试初评评估器\n');

  const evaluator = createPreliminaryEvaluator();

  // 测试配置
  console.log('📋 配置信息:');
  const config = evaluator.getConfig();
  console.log(`  中文模型: ${config.chineseModel}`);
  console.log(`  英文模型: ${config.englishModel}`);
  console.log(`  其他模型: ${config.otherModel}`);
  console.log(`  最低分数: ${config.minValue}\n`);

  // 测试中文文章
  console.log('📄 测试中文文章:');
  const zhResult = await evaluator.evaluate(TEST_ARTICLES.chinese);
  console.log(`  标题: ${TEST_ARTICLES.chinese.title}`);
  console.log(`  语言: ${zhResult.language}`);
  console.log(`  评分: ${zhResult.value}/5`);
  console.log(`  主题: ${zhResult.reason}`);
  console.log(`  总结: ${zhResult.summary}`);
  console.log(`  是否忽略: ${zhResult.ignore ? '是' : '否'}`);
  console.log(`  置信度: ${zhResult.confidence}\n`);

  // 测试英文文章
  console.log('📄 测试英文文章:');
  const enResult = await evaluator.evaluate(TEST_ARTICLES.english);
  console.log(`  标题: ${TEST_ARTICLES.english.title}`);
  console.log(`  语言: ${enResult.language}`);
  console.log(`  评分: ${enResult.value}/5`);
  console.log(`  主题: ${enResult.reason}`);
  console.log(`  总结: ${enResult.summary}`);
  console.log(`  是否忽略: ${enResult.ignore ? '是' : '否'}`);
  console.log(`  置信度: ${enResult.confidence}\n`);

  // 测试短文章
  console.log('📄 测试短文章:');
  const shortResult = await evaluator.evaluate(TEST_ARTICLES.short);
  console.log(`  标题: ${TEST_ARTICLES.short.title}`);
  console.log(`  语言: ${shortResult.language}`);
  console.log(`  评分: ${shortResult.value}/5`);
  console.log(`  主题: ${shortResult.reason}`);
  console.log(`  总结: ${shortResult.summary}`);
  console.log(`  是否忽略: ${shortResult.ignore ? '是' : '否'}\n`);

  return { zhResult, enResult, shortResult };
}

/**
 * 测试模型选择器
 */
async function testModelSelector() {
  console.log('\n🧪 测试模型选择器\n');

  const selector = createModelSelector();

  // 验证配置
  const validation = selector.validateConfig();
  console.log(`配置验证: ${validation.valid ? '✅ 通过' : '❌ 失败'}`);
  if (!validation.valid) {
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }

  // 测试不同语言的模型选择
  const languages = ['zh', 'en', 'ja', 'ko', 'es'];
  const stages: Array<'preliminary' | 'analysis' | 'reflection'> = ['preliminary', 'analysis', 'reflection'];

  console.log('\n📋 模型选择结果:');
  for (const lang of languages) {
    for (const stage of stages) {
      const model = selector.selectModel(lang, stage);
      console.log(`  ${lang}/${stage}: ${model}`);
    }
  }

  // 获取模型统计
  console.log('\n📊 模型使用统计:');
  const stats = selector.getModelStats();
  for (const [model, info] of Object.entries(stats)) {
    console.log(`  ${model}:`);
    console.log(`    语言: ${info.languages.join(', ')}`);
    console.log(`    阶段: ${info.stages.join(', ')}`);
  }
}

/**
 * 测试真实文章（如果有）
 */
async function testRealArticles() {
  console.log('\n🧪 测试真实文章\n');

  // 获取一些有内容的文章
  const entries = await db.entry.findMany({
    where: {
      content: { not: null },
      aiPrelimStatus: null,
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
    take: 5,
  });

  if (entries.length === 0) {
    console.log('没有找到未初评的文章');
    return;
  }

  console.log(`找到 ${entries.length} 篇文章\n`);

  const evaluator = createPreliminaryEvaluator();

  for (const entry of entries) {
    console.log(`📄 ${entry.title}`);

    const evaluation = await evaluator.evaluate({
      title: entry.title,
      content: entry.content || '',
    });

    console.log(`  语言: ${evaluation.language}`);
    console.log(`  评分: ${evaluation.value}/5`);
    console.log(`  主题: ${evaluation.reason}`);
    console.log(`  总结: ${evaluation.summary}`);
    console.log(`  是否忽略: ${evaluation.ignore ? '是' : '否'}`);
    console.log(`  置信度: ${evaluation.confidence}\n`);
  }
}

/**
 * 性能测试
 */
async function performanceTest() {
  console.log('\n🧪 性能测试\n');

  const evaluator = createPreliminaryEvaluator();

  const iterations = 5;
  const times: number[] = [];

  console.log(`运行 ${iterations} 次测试...\n`);

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();

    await evaluator.evaluate(TEST_ARTICLES.chinese);

    const elapsed = Date.now() - start;
    times.push(elapsed);

    console.log(`第 ${i + 1} 次: ${elapsed}ms`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log('\n📊 统计结果:');
  console.log(`  平均: ${Math.round(avgTime)}ms`);
  console.log(`  最快: ${minTime}ms`);
  console.log(`  最慢: ${maxTime}ms`);
}

// =====================================================
// 主函数
// =====================================================

async function main() {
  console.log('==========================================');
  console.log('  初评功能测试');
  console.log('==========================================');

  try {
    // 测试评估器
    await testPreliminaryEvaluator();

    // 测试模型选择器
    await testModelSelector();

    // 测试真实文章
    await testRealArticles();

    // 性能测试
    await performanceTest();

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
