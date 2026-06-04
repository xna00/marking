import type { ModelName } from "./models.js";
import { storageKeys } from "./constants.js";
import { api } from "./api.js";

export type ConfigItem = {
  position: string;
  points: number;
  markingCriteria: string;
};

export const defaultModel: ModelName = "doubao-seed-1-8-251228";

type AIResultItem = [string, number, string];

export async function recognizeImage(imageUrl: string): Promise<AIResultItem[]> {
  const result = await chrome.storage.local.get([
    storageKeys.AI_MODEL as string,
    storageKeys.CRITERIA_CONFIG as string,
  ]);
  const model = (result[storageKeys.AI_MODEL] as ModelName) || defaultModel;
  const config = (result[storageKeys.CRITERIA_CONFIG] as ConfigItem[]) || [];

  const data = await api.ai.markImage({ model, config, imageUrl }) as AIResultItem[];
  console.log("AI识别结果:", data);
  return data;
}
