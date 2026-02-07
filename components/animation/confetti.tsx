/**
 * 彩纸屑动画组件
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
}

interface ConfettiProps {
  trigger: boolean;
  count?: number;
  duration?: number;
  className?: string;
}

const colors = [
  '#f472b6', // pink
  '#60a5fa', // blue
  '#34d399', // green
  '#fbbf24', // yellow
  '#a78bfa', // purple
  '#f87171', // red
];

export function Confetti({
  trigger,
  count = 50,
  duration = 3000,
  className,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isActive, setIsActive] = useState(false);

  const createPiece = useCallback((id: number): ConfettiPiece => ({
    id,
    x: 50 + (Math.random() - 0.5) * 40,
    y: 50,
    rotation: Math.random() * 360,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 6 + Math.random() * 6,
    speedX: (Math.random() - 0.5) * 10,
    speedY: -10 - Math.random() * 10,
  }), []);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      const newPieces = Array.from({ length: count }, (_, i) => createPiece(i));
      setPieces(newPieces);

      const timer = setTimeout(() => {
        setIsActive(false);
        setPieces([]);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [trigger, count, duration, isActive, createPiece]);

  useEffect(() => {
    if (!isActive || pieces.length === 0) return;

    let animationId: number;
    const gravity = 0.3;
    const drag = 0.99;

    const animate = () => {
      setPieces(prev => prev.map(piece => ({
        ...piece,
        x: piece.x + piece.speedX * 0.1,
        y: piece.y + piece.speedY * 0.1,
        rotation: piece.rotation + piece.speedX * 2,
        speedX: piece.speedX * drag,
        speedY: piece.speedY * drag + gravity,
      })));

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [isActive, pieces.length]);

  if (!isActive) return null;

  return (
    <div className={cn('fixed inset-0 pointer-events-none z-50 overflow-hidden', className)}>
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            width: `${piece.size}px`,
            height: `${piece.size * 0.6}px`,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: '1px',
            transition: 'none',
          }}
        />
      ))}
    </div>
  );
}
