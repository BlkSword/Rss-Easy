/**
 * 数据加密工具
 * 用于加密敏感数据（如 API Key）
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 获取加密密钥
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

  if (!key) {
    throw new Error('ENCRYPTION_KEY, JWT_SECRET or NEXTAUTH_SECRET environment variable is required for encryption');
  }

  // 使用 SHA-256 哈希密钥以获得正确的长度（32 字节）
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * 加密文本
 * 使用 AES-256-CBC 加密
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 将 IV 和加密数据组合（格式：IV:加密数据）
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 解密文本
 * 使用 AES-256-CBC 解密
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();

    // 分离 IV 和加密数据
    const parts = encryptedText.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 检查文本是否为加密格式
 */
export function isEncrypted(text: string | null | undefined): boolean {
  if (!text) return false;

  // 加密格式为 hex:hex，检查是否包含 ':' 且两部分都是有效的 hex
  const parts = text.split(':');

  if (parts.length !== 2) return false;

  const [iv, encrypted] = parts;

  // 检查 IV 长度（32 个 hex 字符 = 16 字节）
  if (iv.length !== IV_LENGTH * 2) return false;

  // 检查是否为有效的 hex 字符串
  const hexRegex = /^[0-9a-fA-F]+$/;

  if (!hexRegex.test(iv) || !hexRegex.test(encrypted)) {
    return false;
  }

  return true;
}

/**
 * 如果文本未加密则加密，已加密则返回原文
 */
export function ensureEncrypted(text: string): string {
  if (isEncrypted(text)) {
    return text;
  }
  return encrypt(text);
}

/**
 * 解密文本，如果解密失败返回原文（用于向后兼容）
 */
export function safeDecrypt(encryptedText: string | null | undefined): string {
  if (!encryptedText) return '';

  try {
    return decrypt(encryptedText);
  } catch {
    // 如果解密失败，可能是未加密的旧数据
    return encryptedText;
  }
}
