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

const getCurrentSettings = (): Promise<AISettings> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(["aiModel", "aiPrompt"], (result) => {
      resolve({
        model:
          (result.aiModel as ModelName) || "doubao#doubao-seed-1-6-lite-251015",
        prompt:
          (result.aiPrompt as string) ||
          `
你是一名化学老师，正在批改试卷，这是第(4)题的评分标准，第①小题有两个空，在同一行左右两侧，其它小题各一个空。后续会给你发答题卡的图片，你需要做：
1.识别出图片中第(4)题每个空的内容
2.根据评分标准，判断每个空的得分
3.以{"1.1":{"anwser":"步骤1识别出的该空的内容","socre":1,"reason":""},"2":{...},...}格式返回结果，其中1.1表示第①小题的第一空，以此类推。reason写得精简

评分标准：(4)①500mL容量瓶(1分,不写"500mL"不得分) 13.6(2分)
②25(1分)
③将浓硫酸沿烧杯内壁缓慢注入水中(给分点一),并用玻璃棒不断搅拌(给分点二)(2分,合理即可)
④C(2分)
`.trim(),
      });
    });
  });
};
// 导出AI识别函数，接收图片的dataURL作为参数
export async function markByAI(
  dataUrl: string,
  aiSettings: AISettings,
  apiKeys: APIKeys
) {
  try {
    // 从存储中获取AI设置
    const modelName = aiSettings.model;
    const prompt = aiSettings.prompt;

    const selectedModel = getModelInfo(modelName, apiKeys);

    console.log(selectedModel);
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
      }),
    });

    const data = await response.json();
    console.log("AI识别结果:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("AI识别错误:", error);
    throw error;
  }
}
export async function recognizeImage(dataUrl: string) {
  const settings = await getCurrentSettings();
  // 获取API Keys
  const apiKeys = await new Promise<APIKeys>((resolve) => {
    chrome.storage.local.get(["apiKeys"], (result) => {
      resolve((result.apiKeys as APIKeys) || {});
    });
  });
  return markByAI(dataUrl, settings, apiKeys);
}
