export type ModelName = string;

// 题型由服务器定义并经 @marking/server 类型下发（getQuestionTypes 的返回类型），
// 扩展侧不硬编码枚举，值只作为下拉选项使用。
export type { QuestionType } from "@marking/server";

export type ConfigItem = {
  position: string;
  points: number;
  markingCriteria: string;
};
