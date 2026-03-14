import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CacheService } from "@/lib/cache/redis-cache";

/**
 * 健康检查 API
 * 注意：此端点不暴露敏感信息（版本号、环境详情等）
 */
export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};
  let overallStatus = "ok";

  // 检查数据库连接
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = {
      status: "ok",
      latency: Date.now() - start
    };
  } catch {
    checks.database = {
      status: "error"
    };
    overallStatus = "degraded";
  }

  // 检查 Redis 连接
  try {
    const start = Date.now();
    const redisOk = await CacheService.ping();
    if (redisOk) {
      checks.redis = {
        status: "ok",
        latency: Date.now() - start
      };
    } else {
      checks.redis = {
        status: "disabled"
      };
    }
  } catch {
    checks.redis = {
      status: "error"
    };
    overallStatus = "degraded";
  }

  // 简化响应，不暴露敏感信息
  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  }, {
    status: overallStatus === "ok" ? 200 : 503
  });
}
