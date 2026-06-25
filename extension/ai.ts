import type { ModelName, ConfigItem } from "./models.js";
import { storageKeys } from "./constants.js";
import { api } from "./api.js";
import { chromeStorageLocalGet } from "./storage.js";

export const defaultModel: ModelName = "auto";

import type { AIResultItem } from "@marking/server";
export type { AIResultItem };

export async function recognizeImage(imageUrl: string): Promise<{ result: AIResultItem[]; markRecordId: number }> {
  const storage = await chromeStorageLocalGet([storageKeys.AI_MODEL, storageKeys.CRITERIA_CONFIG]);
  const model = storage[storageKeys.AI_MODEL] || defaultModel;
  const config = storage[storageKeys.CRITERIA_CONFIG] || [];

  const data = await api.ai.markImage({ model, config, imageUrl });
  console.log("[ai] AI识别结果:", data.result);
  return { result: data.result, markRecordId: data.markRecordId };
}
