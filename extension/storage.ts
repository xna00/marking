import { storageKeys, type StorageSchema } from "./constants.js";

export type KT = keyof StorageSchema | (keyof StorageSchema)[] | StorageSchema | null
export type RT<K extends KT> = K extends null ? StorageSchema :
  K extends keyof StorageSchema ? Pick<StorageSchema, K> :
  K extends (keyof StorageSchema)[] ? Pick<StorageSchema, K[number]> :
  K extends StorageSchema ? Required<Pick<StorageSchema, keyof K & keyof StorageSchema>> /* & Omit<K, keyof StorageSchema> */ : never
export const chromeStorageLocalGet = chrome.storage.local.get.bind(chrome.storage.local) as
  <const K extends KT>(keys: K) => Promise<RT<K>>;


export const chromeStorageLocalSet = chrome.storage.local.set.bind(chrome.storage.local) as
  (items: StorageSchema) => Promise<void>;
export const chromeStorageLocalRemove = chrome.storage.local.remove.bind(chrome.storage.local) as
  (keys: keyof StorageSchema | (keyof StorageSchema)[]) => Promise<void>;
