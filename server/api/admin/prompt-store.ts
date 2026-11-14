import { randomUUID } from "node:crypto";
import {
  listPromptRows,
  insertPromptRow,
  updatePromptRow,
  deletePromptRow,
  setAllPromptNotDefault,
  setPromptDefault,
  type PromptRow,
} from "../../db.ts";
import { QUESTION_TYPES, type QuestionType } from "../question-types.ts";

// 提示词定义 + 内存缓存。启动后首次访问从 prompt 表懒加载（表不存在时由
// initDb 的 CREATE TABLE IF NOT EXISTS 自动建），管理页改动写 DB 并同步缓存。
// getActivePromptContent 保持同步调用，不把 ai.ts 的调用方改成 async。
//
// 提示词可编辑：默认提示词编辑后立即生效；要保留旧版本就新建一条再设为
// 默认。没有名称字段，列表里用内容摘要 + 创建时间区分。
// 题型属于提示词自身属性，编辑不换题型（换题型等于另一套模板，应新建）。

// 评分标准在这个位置被替换：default（其他）替换成 md 表格，单行题型替换成
// 「位置:/分值:/细则:」三行（见 ai.ts 的 constructPrompt）
export const PROMPT_PLACEHOLDER = "{{评分标准}}";

export type PromptDef = {
  id: string;
  content: string;
  isDefault: boolean;
  questionType: QuestionType;
  createdAt: string;
  updatedAt: string | null;
};

// 内置提示词 = 改造前 ai.ts 里的 SYSTEM_PROMPT，保证初始化后的行为完全一致。
// default 用现有填空模板（多空、md 表格渲染）；其余题型是单道整体给分（锁 1 行
// 评分标准），占位符渲染成「位置:/分值:/细则:」三行（见 ai.ts 的 renderSingleRow），
// 不用 md 表格——细则可能较长且含竖线等，表格结构易被破坏。
// 单行返回格式为长度一的数组（元组）：[["要点",得分,"理由"]]。
// 作文/简答要点 ≤40 字、理由 ≤30 字；作文理由需指出字数/词数并依据细则写。
const BUILTIN_PROMPTS: Record<QuestionType, string> = {
  default: `你是一名老师，正在批改试卷，你要批改的题有多个空。这是评分标准：
${PROMPT_PLACEHOLDER}

给你发答题卡的图片，你需要做：
1.识别出图片中每个空填写的内容(排除被划掉的内容，不要公式标记，禁止超过30字符，非关键内容用…代替)
2.根据评分标准，判断每个空的得分
3.以[["1中识别出的内容",0(得分),"原因"],...]格式(根据评分标准中序号顺序)返回结果，其中原因不超过15字;识别出的内容完整返回`,
  short: `你是一名老师,正在批改试卷,你要批改的题是简答题。这是评分标准:
${PROMPT_PLACEHOLDER}

给你发答题卡的图片,你需要做:
1.识别出简答题填写的内容(排除被划掉的内容,不要公式标记;如果是分点内容,每点一行;非关键内容用…代替;合计禁止超过50字符)
2.根据评分标准,判断这道题的得分
3.以[["答题内容",0(得分),"原因"]]格式返回结果(只有一项),其中原因不超过30字,原因要依据细则写`,
  chineseEssay: `你是一名老师,正在批改语文作文。这是评分标准:
${PROMPT_PLACEHOLDER}

给你发作文的图片,你需要做:
1.摘录作文要点(排除被划掉的内容,禁止超过40字符,非关键内容用…代替)
2.根据评分标准,判断这篇作文的得分
3.以[["评分要点",0(得分),"理由"]]格式返回结果(只有一项),其中理由不超过30字,理由要依据细则写,并指出字数`,
  englishEssay: `你是一名老师,正在批改英语作文。这是评分标准:
${PROMPT_PLACEHOLDER}

给你发作文的图片,你需要做:
1.摘录作文要点(排除被划掉的内容,禁止超过40字符,非关键内容用…代替)
2.根据评分标准,判断这篇作文的得分
3.以[["评分要点",0(得分),"理由"]]格式返回结果(只有一项),其中理由不超过30字,理由要依据细则写,并指出词数`,
};

let cache: PromptDef[] | null = null;

function toDef(r: PromptRow): PromptDef {
  return {
    id: r.id,
    content: r.content,
    isDefault: r.isDefault !== 0,
    // 白名单收窄：脏数据（非法值）兜底 default，避免污染 UI/构造
    questionType: QUESTION_TYPES.find((t) => t === r.questionType) ?? "default",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function ensureLoaded(): PromptDef[] {
  if (!cache) {
    const now = new Date().toISOString();
    // 每题型无记录则插入内置模板：新库 4 条；旧库迁移后只有 default 一条，
    // 这里补上其余 3 条题型的内置模板（管理页可见、可改）。
    const existing = listPromptRows();
    for (const t of QUESTION_TYPES) {
      if (!existing.some((r) => r.questionType === t)) {
        insertPromptRow({
          id: randomUUID(),
          content: BUILTIN_PROMPTS[t],
          isDefault: 1,
          questionType: t,
          createdAt: now,
          updatedAt: null,
        });
      }
    }
    cache = listPromptRows().map(toDef);
  }
  return cache;
}

export function getAllPrompts(): PromptDef[] {
  return ensureLoaded();
}

// 当前生效的提示词：指定题型的默认那条；数据异常（该题型没有默认项）时回落
// 该题型第一条，再不行用内置模板，保证改卷流程永远不会因为缺提示词而失败
export function getActivePromptContent(questionType: QuestionType): string {
  const list = ensureLoaded();
  return (
    list.find((p) => p.questionType === questionType && p.isDefault) ??
    list.find((p) => p.questionType === questionType)
  )?.content ?? BUILTIN_PROMPTS[questionType];
}

export function createPrompt(content: string, questionType: QuestionType): PromptDef {
  const list = ensureLoaded();
  const prompt: PromptDef = {
    id: randomUUID(),
    content,
    // 正常情况下表里至少有内置的一条，这里只做兜底
    isDefault: list.length === 0,
    questionType,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  insertPromptRow({
    id: prompt.id,
    content: prompt.content,
    isDefault: prompt.isDefault ? 1 : 0,
    questionType: prompt.questionType,
    createdAt: prompt.createdAt,
    updatedAt: null,
  });
  list.push(prompt);
  return prompt;
}

export function updatePrompt(id: string, content: string): PromptDef {
  const list = ensureLoaded();
  const target = list.find((p) => p.id === id);
  if (!target) throw new Error(`提示词不存在: ${id}`);

  target.content = content;
  target.updatedAt = new Date().toISOString();
  updatePromptRow(id, content, target.updatedAt);
  return target;
}

export function deletePrompt(id: string): void {
  const list = ensureLoaded();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) throw new Error(`提示词不存在: ${id}`);
  // 默认提示词不能删，否则会出现没有生效提示词的状态
  if (list[index].isDefault) {
    throw new Error("默认提示词不能删除，请先把其他提示词设为默认");
  }
  deletePromptRow(id);
  list.splice(index, 1);
}

export function setDefaultPrompt(id: string): PromptDef {
  const list = ensureLoaded();
  const target = list.find((p) => p.id === id);
  if (!target) throw new Error(`提示词不存在: ${id}`);

  // 只清同题型的默认：每种题型各自维护一条默认，互不影响
  setAllPromptNotDefault(target.questionType);
  setPromptDefault(id);
  for (const p of list) {
    if (p.questionType === target.questionType) p.isDefault = p.id === id;
  }
  return target;
}
