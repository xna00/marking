import { repairJson } from "./lib.js";
import type { ModelName } from "./models.js";
import { storageKeys } from "./constants.js";
import { api } from "./api.js";

export type ConfigItem = {
  position: string;
  points: number;
  markingCriteria: string;
};

export const defaultModel: ModelName = "doubao-seed-1-8-251228";

const tryManyTimes = async <T>(fn: () => Promise<T>, times = 3) => {
  const errors = [];
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (error) {
      errors.push(error);
      console.error(`尝试第${i + 1}次失败:`, error);
    }
  }
  throw new Error(`尝试${times}次后失败: ${errors.join(", ")}`);
};

export function parseAIResult(aiResult: any): string {
  return aiResult.choices[0].message.content;
}

export async function recognizeImage(imageUrl: string) {
  const result = await chrome.storage.local.get([
    storageKeys.AI_MODEL as string,
    storageKeys.CRITERIA_CONFIG as string,
  ]);
  const model = (result[storageKeys.AI_MODEL] as ModelName) || defaultModel;
  const config = (result[storageKeys.CRITERIA_CONFIG] as ConfigItem[]) || [];

  const fn = async () => {
    const data: { choices: Array<{ message: { content: string } }> } = await api.ai.chat({
      model,
      config,
      imageUrl,
    }) as any;
    if (!data.choices) {
      throw new Error(`AI识别错误: ${JSON.stringify(data)}`);
    }
    try {
      JSON.parse(repairJson(parseAIResult(data)));
      data.choices[0].message.content = repairJson(parseAIResult(data));
    } catch (error) {
      console.log("Can not parse:");
      console.log(parseAIResult(data));
      throw error;
    }
    return data;
  };

  const data = await tryManyTimes(fn);
  console.log("AI识别结果:", data);
  return data;
}