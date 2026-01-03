import type { APIKeys } from "./ai.js";

export type Model = {
  model: string;
  key: string;
  url: string;
};

// 默认URL配置，API Key将从存储中获取
const doubaoUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const glmUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const hunyuanUrl = "https://api.hunyuan.cloud.tencent.com/v1/chat/completions";
const qwenUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

const doubaoModels = [
  "doubao#doubao-seed-1-6-flash-250828",
  "doubao#doubao-seed-1-6-lite-251015",
] as const;
const glmModels = ["glm#glm-4.6v-flash"] as const;
const hunyuanModels = ["hunyuan#hunyuan-lite"] as const;
const qwenModels = [
  "qwen#qwen-flash",
  "qwen#qwen-long-latest",
  "qwen#qwen-max",
  "qwen#deepseek-v3.2",
  "qwen#qwen-vl-max-latest",
  "qwen#qwen3-vl-flash",
  "qwen#qwen-vl-plus-latest",
] as const;

export const modelNames = [
  ...doubaoModels,
  ...glmModels,
  ...hunyuanModels,
  ...qwenModels,
] as const;

export type ModelName = (typeof modelNames)[number];

export const getModelInfo = (modelName: string, apiKeys: APIKeys): Model => {
  if (modelName.startsWith("doubao")) {
    return {
      model: modelName,
      key: apiKeys.doubaoKey || "",
      url: doubaoUrl,
    };
  } else if (modelName.startsWith("glm")) {
    return {
      model: modelName,
      key: apiKeys.glmKey || "",
      url: glmUrl,
    };
  } else if (modelName.startsWith("hunyuan")) {
    return {
      model: modelName,
      key: apiKeys.hunyuanKey || "",
      url: hunyuanUrl,
    };
  } else if (modelName.startsWith("qwen")) {
    return {
      model: modelName,
      key: apiKeys.qwenKey || "",
      url: qwenUrl,
    };
  } else {
    throw new Error(`Unknown model: ${modelName}`);
  }
};