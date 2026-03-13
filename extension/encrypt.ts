// 简单的对称加解密函数（不使用Web Crypto API）

/**
 * 简单的XOR加密
 * @param data 要加密的数据
 * @param key 加密密钥
 * @returns 加密后的数据（Base64编码）
 */
export function simpleEncrypt(data: string, key: string): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return btoa(result);
}

/**
 * 简单的XOR解密
 * @param encryptedData 加密后的数据（Base64编码）
 * @param key 解密密钥
 * @returns 解密后的数据
 */
export function simpleDecrypt(encryptedData: string, key: string): string {
    const decoded = atob(encryptedData);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return result;
}

