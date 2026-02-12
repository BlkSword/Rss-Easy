/**
 * 测试增强的 RSS 解析器
 * 使用用户提供的 XML 文件进行测试
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import Parser from 'rss-parser';
import { rssParser } from '../lib/rss/parser';

const TEST_XML_PATH = 'C:\\Users\\wfshe\\Desktop\\2d790e38f8af54c5af77fa5fed687a7c66d34c22.xml';

async function testParser() {
  console.log('🔍 测试增强的 RSS 解析器\n');
  console.log('📁 测试文件:', TEST_XML_PATH);
  console.log('━'.repeat(80));

  try {
    // 读取 XML 文件内容
    console.log('\n📖 读取 XML 文件...');
    const xmlContent = await fs.readFile(TEST_XML_PATH, 'utf-8');
    console.log(`✅ 文件读取成功 (${xmlContent.length} 字符)`);

    // 使用 rss-parser 直接解析
    console.log('\n⚙️  解析 RSS feed...');
    const parser = new Parser({
      timeout: 10000,
      customFields: {
        feed: ['language', 'lastBuildDate', 'managingEditor', 'image'],
        item: [
          'author',
          'creator',
          'guid',
          'description',
          'summary',
          'published',
          'updated',
          'content:encoded',
          'enclosure',
          'category',
          'categories',
        ],
      },
    });

    const feed = await parser.parseString(xmlContent);

    console.log('\n✅ 解析成功!\n');

    // Feed 信息
    console.log('📰 Feed 信息:');
    console.log(`  标题: ${feed.title}`);
    console.log(`  描述: ${feed.description?.substring(0, 100)}...`);
    console.log(`  链接: ${feed.link}`);
    console.log(`  语言: ${feed.language || 'N/A'}`);
    console.log(`  最后更新: ${feed.lastBuildDate || 'N/A'}`);
    console.log(`  编辑: ${feed.managingEditor || 'N/A'}`);

    if (feed.image) {
      console.log(`  图像: ${feed.image.url || feed.image.link}`);
    }

    // 统计信息
    const items = feed.items || [];
    console.log(`\n📊 统计:`);
    console.log(`  文章总数: ${items.length}`);

    // 显示第一篇文章的详细信息
    if (items.length > 0) {
      const firstItem: any = items[0];
      console.log(`\n📄 第一篇文章详情:`);
      console.log(`  标题: ${firstItem.title}`);
      console.log(`  链接: ${firstItem.link}`);
      console.log(`  作者: ${firstItem.author || firstItem.creator || 'N/A'}`);
      console.log(`  发布日期: ${firstItem.pubDate || firstItem.published || 'N/A'}`);
      console.log(`  更新日期: ${firstItem.updated || 'N/A'}`);
      console.log(`  GUID: ${firstItem.guid || 'N/A'}`);

      // 分类
      if (firstItem.categories && firstItem.categories.length > 0) {
        console.log(`  分类: ${firstItem.categories.join(', ')}`);
      }

      // Enclosure
      if (firstItem.enclosure) {
        console.log(`  附件: ${firstItem.enclosure.url} (${firstItem.enclosure.type || 'unknown'})`);
      }

      // 内容字段检查
      console.log(`\n📝 内容字段:`);
      console.log(`  content:encoded 存在: ${!!firstItem['content:encoded']}`);
      console.log(`  content 存在: ${!!firstItem.content}`);
      console.log(`  description 存在: ${!!firstItem.description}`);
      console.log(`  summary 存在: ${!!firstItem.summary}`);
      console.log(`  contentSnippet 存在: ${!!firstItem.contentSnippet}`);

      // 显示内容长度
      if (firstItem['content:encoded']) {
        console.log(`  content:encoded 长度: ${firstItem['content:encoded'].length} 字符`);
      }
      if (firstItem.contentSnippet) {
        console.log(`  contentSnippet 长度: ${firstItem.contentSnippet.length} 字符`);
        console.log(`\n💬 摘要预览:`);
        console.log(`  ${firstItem.contentSnippet.substring(0, 200)}...`);
      }

      // 显示原始数据字段
      console.log(`\n🔧 原始数据字段:`);
      console.log(`  可用字段: ${Object.keys(firstItem).filter(k => !k.startsWith('_')).join(', ')}`);
    }

    // 分析所有文章的字段覆盖率
    console.log(`\n📈 字段覆盖率:`);

    const stats = {
      title: 0,
      author: 0,
      creator: 0,
      pubDate: 0,
      categories: 0,
      enclosure: 0,
      'content:encoded': 0,
      contentSnippet: 0,
      description: 0,
    };

    items.forEach((item: any) => {
      if (item.title) stats.title++;
      if (item.author) stats.author++;
      if (item.creator) stats.creator++;
      if (item.pubDate || item.published) stats.pubDate++;
      if (item.categories?.length > 0) stats.categories++;
      if (item.enclosure) stats.enclosure++;
      if (item['content:encoded']) stats['content:encoded']++;
      if (item.contentSnippet) stats.contentSnippet++;
      if (item.description) stats.description++;
    });

    const total = items.length;
    console.log(`  标题: ${stats.title}/${total} (${((stats.title / total) * 100).toFixed(1)}%)`);
    console.log(`  作者: ${stats.author}/${total} (${((stats.author / total) * 100).toFixed(1)}%)`);
    console.log(`  创建者: ${stats.creator}/${total} (${((stats.creator / total) * 100).toFixed(1)}%)`);
    console.log(`  发布日期: ${stats.pubDate}/${total} (${((stats.pubDate / total) * 100).toFixed(1)}%)`);
    console.log(`  分类: ${stats.categories}/${total} (${((stats.categories / total) * 100).toFixed(1)}%)`);
    console.log(`  附件: ${stats.enclosure}/${total} (${((stats.enclosure / total) * 100).toFixed(1)}%)`);
    console.log(`  内容(encoded): ${stats['content:encoded']}/${total} (${((stats['content:encoded'] / total) * 100).toFixed(1)}%)`);
    console.log(`  纯文本摘要: ${stats.contentSnippet}/${total} (${((stats.contentSnippet / total) * 100).toFixed(1)}%)`);
    console.log(`  描述: ${stats.description}/${total} (${((stats.description / total) * 100).toFixed(1)}%)`);

    console.log('\n✨ 测试完成!\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testParser();

