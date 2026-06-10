// 网盘通 - 加密工具模块
// 使用 Web Crypto API (AES-GCM) 加密存储密码
// 基于用户邮箱+主密码派生加密密钥

const CryptoUtils = (() => {
  const ALGORITHM = 'AES-GCM';
  const KEY_LENGTH = 256;
  const SALT_PREFIX = 'WangPanTong_Secure_2024_';
  const ITERATIONS = 100000;

  // TextEncoder / TextDecoder
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  /**
   * 将 ArrayBuffer 转为 Hex 字符串
   */
  function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 将 Hex 字符串转为 ArrayBuffer
   */
  function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
  }

  /**
   * 将 ArrayBuffer 转为 Base64 字符串
   */
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 将 Base64 字符串转为 ArrayBuffer
   */
  function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 从邮箱和主密码派生加密密钥
   * @param {string} email - 用户邮箱
   * @param {string} masterPassword - 主密码
   * @returns {Promise<CryptoKey>}
   */
  async function deriveKey(email, masterPassword) {
    const salt = encoder.encode(SALT_PREFIX + email);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterPassword + email),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密明文密码
   * @param {string} plainText - 明文密码
   * @param {string} email - 用户邮箱
   * @param {string} masterPassword - 主密码
   * @returns {Promise<string>} Base64编码的加密数据（含IV）
   */
  async function encrypt(plainText, email, masterPassword) {
    try {
      const key = await deriveKey(email, masterPassword);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = encoder.encode(plainText);
      const cipherText = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv },
        key,
        encoded
      );
      // 将 IV + 密文 拼接后 Base64 编码
      const combined = new Uint8Array(iv.length + cipherText.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(cipherText), iv.length);
      return bufferToBase64(combined.buffer);
    } catch (err) {
      console.error('加密失败:', err);
      throw err;
    }
  }

  /**
   * 解密密码
   * @param {string} encryptedBase64 - Base64编码的加密数据
   * @param {string} email - 用户邮箱
   * @param {string} masterPassword - 主密码
   * @returns {Promise<string>} 明文密码
   */
  async function decrypt(encryptedBase64, email, masterPassword) {
    try {
      const key = await deriveKey(email, masterPassword);
      const combined = new Uint8Array(base64ToBuffer(encryptedBase64));
      const iv = combined.slice(0, 12);
      const cipherText = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: iv },
        key,
        cipherText
      );
      return decoder.decode(decrypted);
    } catch (err) {
      console.error('解密失败:', err);
      throw err;
    }
  }

  /**
   * 计算 SHA-256 哈希（用于验证主密码）
   */
  async function hashPassword(password, email) {
    const data = encoder.encode(password + SALT_PREFIX + email);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
  }

  /**
   * 生成随机验证码
   * @param {number} length
   * @returns {string}
   */
  function generateVerificationCode(length = 6) {
    const chars = '0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  }

  return { encrypt, decrypt, hashPassword, generateVerificationCode };
})();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoUtils;
}