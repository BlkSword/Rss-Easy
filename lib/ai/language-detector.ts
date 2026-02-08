/**
 * 语言检测器
 *
 * 基于 Unicode 范围和 n-gram 的快速语言检测
 * 支持 10+ 种语言
 */

// =====================================================
// 类型定义
// =====================================================

export interface LanguageDetectionResult {
  /** 语言代码 (ISO 639-1) */
  language: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 字符系统 */
  script?: string;
}

export type LanguageCode =
  | 'zh'     // 中文
  | 'en'     // 英语
  | 'ja'     // 日语
  | 'ko'     // 韩语
  | 'es'     // 西班牙语
  | 'fr'     // 法语
  | 'de'     // 德语
  | 'pt'     // 葡萄牙语
  | 'it'     // 意大利语
  | 'ru'     // 俄语
  | 'ar'     // 阿拉伯语
  | 'other'; // 其他

export type ScriptType =
  | 'hanzi'    // 汉字
  | 'kana'     // 日文假名
  | 'hangul'   // 韩文
  | 'latin'    // 拉丁字母
  | 'cyrillic' // 西里尔字母
  | 'arabic'   // 阿拉伯字母
  | 'other';   // 其他

// =====================================================
// 语言检测器类
// =====================================================

export class LanguageDetector {
  private minConfidence = 100; // 最小字符数以达到高置信度

  /**
   * 检测文本语言
   *
   * @param text - 要检测的文本
   * @returns 检测结果
   */
  async detect(text: string): Promise<LanguageDetectionResult> {
    // 空文本处理
    if (!text || text.trim().length === 0) {
      return {
        language: 'other',
        confidence: 0,
        script: 'other',
      };
    }

    // 1. 检测字符系统
    const script = this.detectScript(text);

    // 2. 基于字符系统检测语言
    const language = this.detectByScript(text, script);

    // 3. 计算置信度
    const confidence = this.calculateConfidence(text.length, script, language);

    return { language, confidence, script };
  }

  /**
   * 批量检测
   */
  async detectBatch(texts: string[]): Promise<LanguageDetectionResult[]> {
    return Promise.all(texts.map(text => this.detect(text)));
  }

  /**
   * 检测字符系统
   */
  private detectScript(text: string): ScriptType {
    // 统计各字符系统的字符数
    const hanziCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const kanaCount = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const hangulCount = (text.match(/[\uac00-\ud7af]/g) || []).length;
    const cyrillicCount = (text.match(/[\u0400-\u04ff]/g) || []).length;
    const arabicCount = (text.match(/[\u0600-\u06ff]/g) || []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;

    // 找出占比最高的字符系统
    const counts = {
      hanzi: hanziCount,
      kana: kanaCount,
      hangul: hangulCount,
      cyrillic: cyrillicCount,
      arabic: arabicCount,
      latin: latinCount,
    };

    let maxCount = 0;
    let dominantScript: ScriptType = 'other';

    for (const [script, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantScript = script as ScriptType;
      }
    }

    // 如果所有字符系统都不占主导，返回 other
    if (maxCount === 0) {
      return 'other';
    }

    return dominantScript;
  }

  /**
   * 基于字符系统检测语言
   */
  private detectByScript(text: string, script: ScriptType): LanguageCode {
    switch (script) {
      case 'hanzi':
        return 'zh';

      case 'kana':
        return 'ja';

      case 'hangul':
        return 'ko';

      case 'cyrillic':
        // 俄语是最常见的西里尔字母语言
        return 'ru';

      case 'arabic':
        return 'ar';

      case 'latin':
        // 拉丁字母系统需要进一步区分
        return this.detectLatinLanguage(text);

      default:
        return 'other';
    }
  }

  /**
   * 检测拉丁语系语言
   *
   * 基于常见词的特征检测
   */
  private detectLatinLanguage(text: string): LanguageCode {
    const lowerText = text.toLowerCase();

    // 定义各语言的常见词模式
    const patterns: Record<string, RegExp[]> = {
      en: [
        /\b(the|and|is|in|at|of|to|a|an|be|are|was|were|been|being)\b/g,
        /\b(this|that|these|those|with|from|for|about|as|into|like|through)\b/g,
      ],
      es: [
        /\b(el|la|de|que|y|a|en|un|una|es|son|con|por|para|como|estar|hay)\b/g,
        /\b(este|esta|esto|pero|más|todo|también|tiempo|año|ver)\b/g,
      ],
      fr: [
        /\b(le|la|de|et|à|un|une|en|une|est|son|avec|pour|pas|plus|comme)\b/g,
        /\b(ce|cet|cette|ces|mais|tout|aussi|temps|an|voir|faire)\b/g,
      ],
      de: [
        /\b(der|die|das|und|in|den|von|zu|das|sich|mit|für|auf|ist|im)\b/g,
        /\b(dieser|diese|dieses|aber|auch|alle|zwischen|durch|wieder|ohne)\b/g,
      ],
      pt: [
        /\b(o|a|de|e|em|um|uma|é|são|com|para|não|se|mas|como|mais)\b/g,
        /\b(este|esta|isto|mas|tudo|também|tempo|ano|ver|por|entre)\b/g,
      ],
      it: [
        /\b(il|la|di|e|in|un|una|è|sono|con|per|non|ma|come|più)\b/g,
        /\b(questo|questa|questo|ma|tutto|anche|tempo|anno|vedere)\b/g,
      ],
    };

    // 统计各语言的匹配数
    let maxMatches = 0;
    let detectedLang: LanguageCode = 'en'; // 默认英语

    for (const [lang, regexList] of Object.entries(patterns)) {
      let totalMatches = 0;

      for (const regex of regexList) {
        const matches = lowerText.match(regex);
        totalMatches += matches ? matches.length : 0;
      }

      if (totalMatches > maxMatches) {
        maxMatches = totalMatches;
        detectedLang = lang as LanguageCode;
      }
    }

    // 如果没有足够的匹配，返回英语作为默认
    return maxMatches > 0 ? detectedLang : 'en';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    textLength: number,
    script: ScriptType,
    language: LanguageCode
  ): number {
    let confidence = 0.5; // 基础置信度

    // 文本长度影响
    if (textLength >= this.minConfidence) {
      confidence += 0.3;
    } else if (textLength >= 50) {
      confidence += 0.2;
    } else if (textLength >= 20) {
      confidence += 0.1;
    }

    // 字符系统和语言的匹配度
    const confidenceBonus: Record<ScriptType, number> = {
      hanzi: 0.2,      // 中文很明确
      kana: 0.2,       // 日文假名很明确
      hangul: 0.2,     // 韩文很明确
      cyrillic: 0.15,  // 西里尔字母较明确
      arabic: 0.15,    // 阿拉伯字母较明确
      latin: 0.1,      // 拉丁字母需要进一步区分
      other: 0,
    };

    confidence += confidenceBonus[script] || 0;

    // 特定语言的置信度调整
    if (language === 'zh' && script === 'hanzi') {
      confidence += 0.1;
    } else if (language === 'ja' && script === 'kana') {
      confidence += 0.1;
    } else if (language === 'ko' && script === 'hangul') {
      confidence += 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * 快速检测（仅返回语言代码）
   */
  quickDetect(text: string): LanguageCode {
    if (!text) return 'other';

    // 快速字符检测
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';

    // 默认英语
    return 'en';
  }

  /**
   * 获取语言名称
   */
  getLanguageName(code: LanguageCode): string {
    const names: Record<LanguageCode, string> = {
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      pt: 'Português',
      it: 'Italiano',
      ru: 'Русский',
      ar: 'العربية',
      other: 'Other',
    };

    return names[code] || 'Unknown';
  }

  /**
   * 检查是否支持该语言
   */
  isSupported(language: string): language is LanguageCode {
    const supported: LanguageCode[] = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'other'];
    return supported.includes(language as LanguageCode);
  }
}

// =====================================================
// 默认实例
// =====================================================

export const languageDetector = new LanguageDetector();

/**
 * 快速检测语言
 */
export async function detectLanguage(text: string): Promise<LanguageCode> {
  const result = await languageDetector.detect(text);
  return result.language as LanguageCode;
}

/**
 * 快速检测语言（同步版本）
 */
export function quickDetectLanguage(text: string): LanguageCode {
  return languageDetector.quickDetect(text);
}

/**
 * 批量检测语言
 */
export async function detectLanguages(texts: string[]): Promise<LanguageCode[]> {
  const results = await languageDetector.detectBatch(texts);
  return results.map(r => r.language as LanguageCode);
}
