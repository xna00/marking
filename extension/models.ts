export const doubaoUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

const doubaoModels = [
  "doubao-seed-1-8-251228",
  "doubao-seed-2-0-pro-260215",
  "doubao-seed-2-0-lite-260428",
  "doubao-seed-2-0-mini-260428",
  "doubao-seed-1-6-lite-251015",
  "doubao-seed-1-6-flash-250828",
] as const;

export const modelNames = [
  "auto",
  ...doubaoModels,
] as const;

export type ModelName = (typeof modelNames)[number];
