import { NextResponse } from "next/server";
import { ensureAIWorkerStarted } from "@/lib/ai/worker-bootstrap";

export async function GET() {
  // 启动AI分析队列（异步，不阻塞响应）
  ensureAIWorkerStarted().catch(err => {
    console.error('启动AI队列失败:', err);
  });

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
}
