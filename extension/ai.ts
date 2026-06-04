import type { ModelName } from "./models.js";
import { storageKeys } from "./constants.js";
import { api } from "./api.js";

export type ConfigItem = {
  position: string;
  points: number;
  markingCriteria: string;
};

export const defaultModel: ModelName = "auto";

type AIResultItem = [string, number, string];

export async function recognizeImage(imageUrl: string): Promise<{ result: AIResultItem[]; markRecordId: number }> {
  const storage = await chrome.storage.local.get([
    storageKeys.AI_MODEL as string,
    storageKeys.CRITERIA_CONFIG as string,
  ]);
  const model = (storage[storageKeys.AI_MODEL] as ModelName) || defaultModel;
  const config = (storage[storageKeys.CRITERIA_CONFIG] as ConfigItem[]) || [];

  const data = await api.ai.markImage({ model, config, imageUrl });
  console.log("AI识别结果:", data.result);
  return { result: data.result, markRecordId: data.markRecordId };
}
