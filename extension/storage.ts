// storage.ts - IndexedDB键值对存储实现

// 数据库配置
const DB_NAME = 'markingExtensionDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyValueStore';

// 打开数据库连接
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // 数据库升级或创建时调用
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建键值对存储对象
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    // 数据库打开成功
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    // 数据库打开失败
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * 保存键值对到IndexedDB
 * @param key 键名
 * @param value 值（可以是任何可序列化的数据类型，包括Blob等大文件）
 */
export const saveKeyValue = async (key: string, value: any): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, value, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
  });
};

/**
 * 从IndexedDB获取值
 * @param key 键名
 * @returns 存储的值，如果不存在则返回undefined
 */
export const getValue = async (key: string): Promise<any | undefined> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : undefined);
    };
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
  });
};

/**
 * 从IndexedDB删除键值对
 * @param key 键名
 */
export const deleteKey = async (key: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
  });
};

/**
 * 清空IndexedDB中的所有键值对
 */
export const clearAll = async (): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
  });
};

/**
 * 获取所有键值对
 * @returns 所有键值对的数组
 */
export const getAllKeyValuePairs = async (): Promise<Array<{ key: string; value: any; timestamp: number }>> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
  });
};

/**
 * 保存图片DataURL到IndexedDB
 * @param dataUrl 图片的DataURL
 * @param mimeType 图片的MIME类型
 * @returns 生成的图片ID
 */
export const saveImageDataURL = async (dataUrl: string, mimeType: string = 'image/png'): Promise<string> => {
  // 将DataURL转换为Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  
  // 生成唯一ID
  const imageId = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 保存到IndexedDB
  await saveKeyValue(imageId, {
    type: 'image',
    mimeType,
    blob,
    size: blob.size
  });
  
  return imageId;
};

/**
 * 保存文件到IndexedDB
 * @param file 要保存的File对象
 * @returns 生成的文件ID
 */
export const saveFile = async (file: File): Promise<string> => {
  // 生成唯一ID
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 保存到IndexedDB
  await saveKeyValue(fileId, {
    type: 'file',
    name: file.name,
    mimeType: file.type,
    blob: file,
    size: file.size
  });
  
  return fileId;
};

/**
 * 根据ID获取文件或图片
 * @param id 文件或图片的ID
 * @returns 文件或图片对象
 */
export const getFileById = async (id: string): Promise<{ type: string; name?: string; mimeType: string; blob: Blob; size: number } | undefined> => {
  return await getValue(id);
};