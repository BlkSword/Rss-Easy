'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  AlignLeft,
  X,
  Check,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: 'system' | 'serif' | 'sans';
  theme: 'light' | 'dark' | 'sepia';
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 16,
  lineHeight: 1.8,
  fontFamily: 'system',
  theme: 'light',
};

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('rss-reader-settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch {
        // 使用默认设置
      }
    }
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('rss-reader-settings', JSON.stringify(updated));
  };

  return { settings, updateSettings, isLoaded };
}

interface MobileReaderSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileReaderSettings({ isOpen, onClose }: MobileReaderSettingsProps) {
  const isMobile = useIsMobile();
  const { settings, updateSettings } = useReaderSettings();

  if (!isMobile) return null;

  const fontSizes = [14, 16, 18, 20, 22, 24];
  const lineHeights = [1.5, 1.6, 1.8, 2.0, 2.2];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* 设置面板 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-background rounded-t-2xl',
              'max-h-[80vh] overflow-y-auto'
            )}
          >
            {/* 拖动指示条 */}
            <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-background z-10">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="px-4 pb-8">
              {/* 标题 */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">阅读设置</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 主题选择 */}
              <section className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  主题
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <ThemeOption
                    label="浅色"
                    isActive={settings.theme === 'light'}
                    onClick={() => updateSettings({ theme: 'light' })}
                    previewClass="bg-white border-gray-200"
                  />
                  <ThemeOption
                    label="深色"
                    isActive={settings.theme === 'dark'}
                    onClick={() => updateSettings({ theme: 'dark' })}
                    previewClass="bg-gray-900 border-gray-700"
                  />
                  <ThemeOption
                    label="sepia"
                    isActive={settings.theme === 'sepia'}
                    onClick={() => updateSettings({ theme: 'sepia' })}
                    previewClass="bg-[#f4ecd8] border-[#d3c7a8]"
                  />
                </div>
              </section>

              {/* 字体大小 */}
              <section className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  字体大小
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm">A</span>
                  <div className="flex-1 flex gap-2">
                    {fontSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => updateSettings({ fontSize: size })}
                        className={cn(
                          'flex-1 h-10 rounded-lg text-sm font-medium',
                          'transition-all duration-200',
                          settings.fontSize === size
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                        style={{ fontSize: size }}
                      >
                        A
                      </button>
                    ))}
                  </div>
                  <span className="text-lg">A</span>
                </div>
              </section>

              {/* 行高 */}
              <section className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4" />
                  行高
                </h3>
                <div className="flex gap-2">
                  {lineHeights.map((height) => (
                    <button
                      key={height}
                      onClick={() => updateSettings({ lineHeight: height })}
                      className={cn(
                        'flex-1 py-3 rounded-lg text-sm',
                        'transition-all duration-200',
                        settings.lineHeight === height
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="space-y-[2px]">
                          <div className="w-6 h-[2px] bg-current rounded-full" />
                          <div className="w-6 h-[2px] bg-current rounded-full" />
                          <div className="w-6 h-[2px] bg-current rounded-full" />
                        </div>
                        <span className="text-xs">{height.toFixed(1)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* 字体 */}
              <section className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">字体</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'system', label: '系统', font: 'system-ui' },
                    { id: 'sans', label: '无衬线', font: 'sans-serif' },
                    { id: 'serif', label: '衬线', font: 'serif' },
                  ].map((font) => (
                    <button
                      key={font.id}
                      onClick={() => updateSettings({ fontFamily: font.id as ReaderSettings['fontFamily'] })}
                      className={cn(
                        'py-3 px-4 rounded-lg text-sm',
                        'transition-all duration-200',
                        settings.fontFamily === font.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                      style={{ fontFamily: font.font }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* 预览 */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">预览</h3>
                <div
                  className={cn(
                    'p-4 rounded-xl',
                    settings.theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-muted'
                  )}
                  style={{
                    fontSize: settings.fontSize,
                    lineHeight: settings.lineHeight,
                    fontFamily: settings.fontFamily === 'system' ? 'system-ui' : settings.fontFamily,
                  }}
                >
                  <p className="mb-2">
                    这是一段预览文本，用于展示当前的阅读设置效果。
                  </p>
                  <p>
                    您可以调整字体大小、行高和主题，找到最适合您的阅读体验。
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ThemeOption({
  label,
  isActive,
  onClick,
  previewClass,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  previewClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-3 rounded-xl',
        'transition-all duration-200',
        isActive ? 'bg-primary/10' : 'hover:bg-muted'
      )}
    >
      <div
        className={cn(
          'w-full aspect-square rounded-lg border-2 flex items-center justify-center',
          previewClass,
          isActive && 'border-primary'
        )}
      >
        {isActive && <Check className="w-5 h-5 text-primary" />}
      </div>
      <span className={cn(
        'text-sm',
        isActive ? 'text-primary font-medium' : 'text-muted-foreground'
      )}>
        {label}
      </span>
    </button>
  );
}

export default MobileReaderSettings;
