/**
 * Utils 测试
 */

import { describe, it, expect } from '@jest/globals';
import { generateContentHash, slugify } from '@/lib/utils';

describe('generateContentHash', () => {
  it('should generate consistent hash for same input', async () => {
    const input = 'test content';
    const hash1 = await generateContentHash(input);
    const hash2 = await generateContentHash(input);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different inputs', async () => {
    const hash1 = await generateContentHash('content 1');
    const hash2 = await generateContentHash('content 2');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', async () => {
    const hash = await generateContentHash('');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });
});

describe('slugify', () => {
  it('should convert Chinese to slug', () => {
    expect(slugify('测试文章')).toBe('ce-shi-wen-zhang');
  });

  it('should handle special characters', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('test@#$%file')).toBe('test-file');
  });

  it('should handle multiple spaces', () => {
    expect(slugify('hello   world   test')).toBe('hello-world-test');
  });

  it('should return empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});
