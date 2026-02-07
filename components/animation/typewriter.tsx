/**
 * 打字机效果组件
 */

'use client';

import { useTypewriter } from '@/hooks/use-animation';
import { cn } from '@/lib/utils';

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  showCursor?: boolean;
  onComplete?: () => void;
}

export function Typewriter({
  text,
  speed = 50,
  delay = 0,
  className,
  showCursor = true,
  onComplete,
}: TypewriterProps) {
  const { displayText, isComplete } = useTypewriter(text, speed, delay);

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {displayText}
      {showCursor && !isComplete && (
        <span className="animate-blink text-primary">|</span>
      )}
    </span>
  );
}
