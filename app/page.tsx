'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ReaderLayout } from '@/components/layout/reader-layout';
import { FullscreenLoader } from '@/components/animation/loading';

function HomePageContent() {
  const searchParams = useSearchParams();
  const feedId = searchParams.get('feed');

  return (
    <ReaderLayout
      filters={{
        feedId: feedId || undefined,
      }}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<FullscreenLoader />}>
      <HomePageContent />
    </Suspense>
  );
}
