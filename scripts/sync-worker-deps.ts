/**
 * Worker 依赖同步脚本
 *
 * 从主 package.json 同步 Worker 依赖版本，确保版本一致性
 *
 * 使用: pnpm run sync:worker-deps
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Worker 需要的依赖列表（按功能分类）
const WORKER_DEPENDENCIES = {
  // 队列系统
  queue: ['bullmq', 'ioredis'],

  // 数据库（prisma 需要在生产环境运行 generate）
  database: ['@prisma/client', 'prisma'],

  // AI 服务
  ai: ['openai', '@anthropic-ai/sdk'],

  // RSS/HTTP 解析
  rss: ['rss-parser', 'cheerio', 'axios', 'fast-xml-parser', 'iconv-lite'],

  // 代理支持
  proxy: ['https-proxy-agent', 'socks-proxy-agent'],

  // 加密/认证
  auth: ['bcrypt', 'jose'],

  // 工具库
  utils: ['zod', 'nanoid', 'dayjs', 'date-fns', 'superjson'],

  // Markdown 处理
  markdown: ['marked'],

  // 运行时
  runtime: ['tsx'],
};

// Worker 需要的开发依赖
const WORKER_DEV_DEPENDENCIES = [
  '@types/bcrypt',
  '@types/node',
  'prisma',
  'typescript',
];

const rootDir = join(__dirname, '..');
const mainPkgPath = join(rootDir, 'package.json');
const workerPkgPath = join(rootDir, 'package.worker.json');

interface PkgJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

function syncDependencies() {
  console.log('🔄 开始同步 Worker 依赖...\n');

  // 读取主 package.json
  if (!existsSync(mainPkgPath)) {
    console.error('❌ 未找到 package.json');
    process.exit(1);
  }

  const mainPkg: PkgJson = JSON.parse(readFileSync(mainPkgPath, 'utf-8'));

  // 收集所有需要的依赖名称
  const allRequiredDeps = Object.values(WORKER_DEPENDENCIES).flat();

  // 构建依赖对象
  const workerDeps: Record<string, string> = {};
  const workerDevDeps: Record<string, string> = {};
  const workerOptionalDeps: Record<string, string> = {};
  const missingDeps: string[] = [];

  // 同步生产依赖
  for (const dep of allRequiredDeps) {
    const version = mainPkg.dependencies?.[dep];
    if (version) {
      // 代理相关依赖放入 optionalDependencies
      if (WORKER_DEPENDENCIES.proxy.includes(dep)) {
        workerOptionalDeps[dep] = version;
      } else {
        workerDeps[dep] = version;
      }
    } else {
      missingDeps.push(dep);
    }
  }

  // 同步开发依赖
  for (const dep of WORKER_DEV_DEPENDENCIES) {
    const version = mainPkg.devDependencies?.[dep] || mainPkg.dependencies?.[dep];
    if (version) {
      workerDevDeps[dep] = version;
    } else {
      missingDeps.push(dep);
    }
  }

  // 报告缺失的依赖
  if (missingDeps.length > 0) {
    console.warn('⚠️  以下依赖在主 package.json 中未找到:');
    missingDeps.forEach(dep => console.warn(`   - ${dep}`));
    console.log('');
  }

  // 构建 Worker package.json
  const workerPkg = {
    name: 'rss-post-worker',
    version: mainPkg.version,
    private: true,
    description: 'Worker dependencies for RSS-Post (optimized)',
    dependencies: workerDeps,
    devDependencies: workerDevDeps,
    ...(Object.keys(workerOptionalDeps).length > 0 && { optionalDependencies: workerOptionalDeps }),
    engines: mainPkg.engines,
  };

  // 写入文件
  writeFileSync(workerPkgPath, JSON.stringify(workerPkg, null, 2) + '\n');

  // 输出统计
  const totalDeps = Object.keys(workerDeps).length;
  const totalDevDeps = Object.keys(workerDevDeps).length;
  const totalOptionalDeps = Object.keys(workerOptionalDeps).length;

  console.log('✅ Worker 依赖同步完成!\n');
  console.log('📊 依赖统计:');
  console.log(`   生产依赖: ${totalDeps} 个`);
  console.log(`   开发依赖: ${totalDevDeps} 个`);
  console.log(`   可选依赖: ${totalOptionalDeps} 个`);
  console.log(`   总计: ${totalDeps + totalDevDeps + totalOptionalDeps} 个\n`);

  // 按类别列出依赖
  console.log('📦 依赖列表:');
  for (const [category, deps] of Object.entries(WORKER_DEPENDENCIES)) {
    const found = deps.filter(d => workerDeps[d] || workerOptionalDeps[d]);
    if (found.length > 0) {
      console.log(`   ${category}: ${found.join(', ')}`);
    }
  }
  console.log(`   devDeps: ${Object.keys(workerDevDeps).join(', ')}\n`);

  console.log(`📝 文件已保存到: ${workerPkgPath}`);
}

// 执行同步
syncDependencies();
