/**
 * 等待数据库就绪的跨平台脚本
 */

const { execSync } = require('child_process');

const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000; // 1秒

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // 忙等待
  }
}

function checkPostgreSQL() {
  try {
    execSync('docker exec rss-easy-db-dev pg_isready -U rss_easy', {
      stdio: 'pipe',
      timeout: 5000
    });
    return true;
  } catch (e) {
    return false;
  }
}

function checkRedis() {
  try {
    const result = execSync('docker exec rss-easy-redis-dev redis-cli ping', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    return result.includes('PONG');
  } catch (e) {
    return false;
  }
}

async function waitForDatabase() {
  console.log('等待数据库启动...');

  // 等待 PostgreSQL
  for (let i = 0; i < MAX_RETRIES; i++) {
    if (checkPostgreSQL()) {
      console.log('✅ PostgreSQL 已就绪');
      break;
    }
    console.log(`  PostgreSQL 等待中... (${i + 1}/${MAX_RETRIES})`);
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));

    if (i === MAX_RETRIES - 1) {
      console.error('❌ PostgreSQL 启动超时');
      process.exit(1);
    }
  }

  // 等待 Redis
  for (let i = 0; i < MAX_RETRIES; i++) {
    if (checkRedis()) {
      console.log('✅ Redis 已就绪');
      break;
    }
    console.log(`  Redis 等待中... (${i + 1}/${MAX_RETRIES})`);
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));

    if (i === MAX_RETRIES - 1) {
      console.warn('⚠️ Redis 未就绪，但继续执行');
    }
  }

  console.log('');
}

waitForDatabase();
