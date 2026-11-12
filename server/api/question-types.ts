// 题型定义：决定评分提示词模板（第 2 步起按题型取模板）。
// 列表值由服务器定义并通过 getQuestionTypes() 下发给扩展下拉，加/减题型只改这里，
// 扩展不用重新发版。服务器是唯一事实源。
// 独立成文件（而非放在 ai.ts）：prompt-store.ts 也要用 QuestionType，
// 避免 prompt-store ←→ ai 的循环依赖。
export const QUESTION_TYPES = ["default", "short", "chineseEssay", "englishEssay"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  default: "默认",
  short: "简答",
  chineseEssay: "语文作文",
  englishEssay: "英语作文",
};
