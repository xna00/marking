import { repairJson } from "./lib.js";
import { getModelInfo, type ModelName } from "./models.js";

export type AISettings = {
  model: ModelName;
  prompt: string;
};

export interface APIKeys {
  doubaoKey?: string;
  glmKey?: string;
  hunyuanKey?: string;
  qwenKey?: string;
}

export const defaultAISettings: AISettings = {
  model: "doubao#doubao-seed-1-6-lite-251015",
  prompt: `
你是一名化学老师，正在批改试卷，你要批改的是第(4)题,一共5个空。这是评分标准：
序号|位置|分值|评分标准
-|-|-|-
1|第一行左边|1|500mL容量瓶(不写“500mL”不得分，把“容量瓶”写成“溶量瓶”不得分)
2|第一行右边|2|13.6
3|第二行|1|25
4|第三行|2|将浓硫酸沿烧杯内壁缓慢注入水中(给分点一),并用玻璃棒不断搅拌(给分点二)（合理即可）
5|第四行|2|C

给你发答题卡的图片，你需要做：
1.识别出图片中每个空的内容
2.根据评分标准，判断每个空的得分
3.严格用JSON返回,格式:[["1中识别出的内容",0(得分),"原因(只写关键词)"],...]
`.trim(),
};

const getCurrentSettings = async (): Promise<AISettings> => {
  const result = await chrome.storage.local.get([
    "aiModel",
    "aiPrompt",
    "criteria",
    "criteriaHeader",
  ]);
  const model = (result.aiModel as ModelName) || defaultAISettings.model;
  const prompt = (result.aiPrompt as string) || defaultAISettings.prompt;
  const criteria = result.criteria as string[][];
  const criteriaHeader = result.criteriaHeader as string[];
  const mdTable = `
${["序号", ...criteriaHeader].join("|")}
-|${criteriaHeader.map(() => "-").join("|")}
${criteria.map((row, index) => `${index + 1}|${row.join("|")}`).join("\n")}
`.trim();
  const ret = {
    model,
    prompt: prompt.replace("{{评分标准}}", mdTable),
  };
  console.log(ret);
  return ret;
};

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
export async function markByAI(
  dataUrl: string,
  aiSettings: AISettings,
  apiKeys: APIKeys
) {
  // 从存储中获取AI设置
  const modelName = aiSettings.model;
  const prompt = aiSettings.prompt;

  const selectedModel = getModelInfo(modelName, apiKeys);

  // console.log(selectedModel);
  const fn = async () => {
    const response = await fetch(selectedModel.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${selectedModel.key}`,
      },
      body: JSON.stringify({
        model: selectedModel.model.split("#")[1],
        thinking: { type: "disabled" },
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: prompt,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        // response_format 会占用token，所以这里不使用
        resonse_format: {
          type: "json_object",
        },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI识别错误:", errorText);
      throw new Error(`AI识别错误: ${errorText}`);
    }
    const data = await response.json();
    try {
      // TODO: use jsonrepair or dirty-json to repair the broken json
      JSON.parse(repairJson(parseAIResult(data)));
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

export function parseAIResult(aiResult: any): string {
  return aiResult.choices[0].message.content;
}
export async function recognizeImage(imageUrl: string) {
  const settings = await getCurrentSettings();
  // 获取API Keys
  const apiKeys = await new Promise<APIKeys>((resolve) => {
    chrome.storage.local.get(["apiKeys"], (result) => {
      resolve((result.apiKeys as APIKeys) || {});
    });
  });
  return markByAI(imageUrl, settings, apiKeys);
}
