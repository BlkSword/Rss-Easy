/**
 * 订阅源管理页面 - 统一管理所有订阅源操作
 * 功能：添加、查看、编辑订阅源
 */

import { Suspense } from 'react';
import { FeedsManagePageContent } from './feeds-manage-page-content';

export default function FeedsManagePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">加载中...</div>}>
      <FeedsManagePageContent />
    </Suspense>
  );
}
