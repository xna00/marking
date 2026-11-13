// 题型定义：决定评分提示词模板（第 2 步起按题型取模板）。
// 列表值由服务器定义并通过 getQuestionTypes() 下发给扩展下拉，加/减题型只改这里，
// 扩展不用重新发版。服务器是唯一事实源。
// 独立成文件（而非放在 ai.ts）：prompt-store.ts 也要用 QuestionType，
// 避免 prompt-store ←→ ai 的循环依赖。
export const QUESTION_TYPES = ["default", "short", "chineseEssay", "englishEssay"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  // default 实际覆盖除简答/作文外的所有常规题（选择/填空/计算/多空/分小问），
  // 「默认」是技术词不是题型名，用「其他」表达兜底语义更直观。
  default: "其他",
  short: "简答",
  chineseEssay: "语文作文",
  englishEssay: "英语作文",
};
