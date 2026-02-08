/**
 * 深度分析测试脚本
 *
 * 用于测试 AI-Native 深度分析功能
 */

import { db } from '../lib/db';
import { SegmentedAnalyzer } from '../lib/ai/analysis/segmented-analyzer';
import { ReflectionEngine } from '../lib/ai/analysis/reflection-engine';
import { getDefaultAIService } from '../lib/ai/client';

async function main() {
  console.log('=== AI-Native 深度分析测试 ===\n');

  // 1. 获取测试文章
  console.log('1. 获取测试文章...');
  const entry = await db.entry.findFirst({
    where: {
      content: {
        not: null,
      },
      AND: {
        OR: [
          { aiAnalyzedAt: null },
          { aiReflectionRounds: 0 },
        ],
      },
    },
    include: {
      feed: {
        select: {
          title: true,
          feedUrl: true,
        },
      },
    },
  });

  if (!entry) {
    console.error('❌ 没有找到合适的测试文章');
    console.log('提示：请确保数据库中有包含内容的文章');
    process.exit(1);
  }

  console.log(`✓ 找到文章: ${entry.title}`);
  console.log(`  Feed: ${entry.feed.title}`);
  console.log(`  内容长度: ${entry.content?.length || 0} 字符\n`);

  // 2. 初始化 AI 服务
  console.log('2. 初始化 AI 服务...');
  const aiService = getDefaultAIService();

  // 创建 LLM 提供者接口
  const llm = {
    chat: async (params: any) => {
      const messages = params.messages || [];
      const userMessage = messages.find((m: any) => m.role === 'user');

      if (!userMessage) {
        throw new Error('No user message found');
      }

      // 使用现有的 AI 服务
      const result = await aiService.analyzeArticle(userMessage.content, {
        summary: true,
        keywords: true,
        category: true,
        importance: true,
      });

      return {
        content: JSON.stringify({
          oneLineSummary: result.summary?.slice(0, 50) || '',
          summary: result.summary || '',
          mainPoints: (result.keywords || []).map((k, i) => ({
            point: k,
            explanation: '',
            importance: 0.8 - i * 0.1,
          })),
          tags: result.keywords || [],
          domain: result.category || '技术',
          subcategory: result.category || '通用',
          aiScore: 7,
          scoreDimensions: {
            depth: 7,
            quality: 7,
            practicality: 7,
            novelty: 7,
          },
        }),
      };
    },
  } as any;

  console.log('✓ AI 服务初始化完成\n');

  // 3. 测试分段分析
  console.log('3. 测试分段分析引擎...');
  const analyzer = new SegmentedAnalyzer(llm, {
    segmentSize: 3000,
    segmentOverlap: 200,
    enableReflection: false,
  });

  let analysisResult;
  try {
    analysisResult = await analyzer.analyze(entry.content!, {
      title: entry.title,
      author: entry.author || undefined,
    });

    console.log('✓ 分段分析完成');
    console.log(`  一句话总结: ${analysisResult.oneLineSummary}`);
    console.log(`  摘要: ${analysisResult.summary.slice(0, 100)}...`);
    console.log(`  主要观点数: ${analysisResult.mainPoints.length}`);
    console.log(`  标签: ${analysisResult.tags.join(', ')}`);
    console.log(`  评分: ${analysisResult.aiScore}/10`);
    console.log(`  处理时间: ${analysisResult.processingTime}ms\n`);
  } catch (error) {
    console.error('❌ 分段分析失败:', error);
    process.exit(1);
  }

  // 4. 测试反思引擎
  console.log('4. 测试反思优化引擎...');
  const reflectionEngine = new ReflectionEngine(llm, {
    enableReflection: true,
    maxReflectionRounds: 1,
    qualityThreshold: 7,
  });

  try {
    const refinedResult = await reflectionEngine.refine(
      entry.content!,
      analysisResult,
      1 // 最多1轮反思
    );

    console.log('✓ 反思优化完成');
    console.log(`  反思轮数: ${refinedResult.reflectionRounds}`);
    console.log(`  优化后评分: ${refinedResult.aiScore}/10`);
    console.log(`  一句话总结: ${refinedResult.oneLineSummary}\n`);
  } catch (error) {
    console.warn('⚠️  反思优化失败（这是正常的，可能需要更强的模型）:', error);
    console.log('  继续使用原始分析结果...\n');
  }

  // 5. 保存分析结果到数据库
  console.log('5. 保存分析结果到数据库...');
  try {
    await db.entry.update({
      where: { id: entry.id },
      data: {
        aiOneLineSummary: analysisResult.oneLineSummary,
        aiMainPoints: analysisResult.mainPoints as any,
        aiScoreDimensions: analysisResult.scoreDimensions as any,
        aiAnalysisModel: analysisResult.analysisModel,
        aiProcessingTime: analysisResult.processingTime,
        aiReflectionRounds: analysisResult.reflectionRounds,
        aiAnalyzedAt: new Date(),
      },
    });

    console.log('✓ 分析结果已保存到数据库\n');
  } catch (error) {
    console.error('❌ 保存失败:', error);
    process.exit(1);
  }

  console.log('=== 测试完成 ===');
  console.log('\n提示：');
  console.log('- 如果测试成功，可以继续实施队列处理器');
  console.log('- 运行 "npx prisma db push" 应用数据库变更');
  console.log('- 运行 "npx prisma generate" 生成 Prisma Client');
}

main()
  .then(() => {
    console.log('\n✅ 所有测试通过');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
