import { randomUUID } from "node:crypto";
import {
  listPromptRows,
  countPromptRows,
  insertPromptRow,
  deletePromptRow,
  setAllPromptNotDefault,
  setPromptDefault,
  type PromptRow,
} from "../../db.ts";

// 提示词定义 + 内存缓存。启动后首次访问从 prompt 表懒加载（表不存在时由
// initDb 的 CREATE TABLE IF NOT EXISTS 自动建），管理页改动写 DB 并同步缓存。
// getActivePromptContent 保持同步调用，不把 ai.ts 的调用方改成 async。
//
// 提示词创建后不可修改：要改内容就新建一条再设为默认，旧的删不删都行，
// 天然起到版本留档的作用。没有名称字段，列表里用内容摘要 + 创建时间区分。

// 评分标准在这个位置被替换成 md 表格（见 ai.ts 的 constructPrompt）
export const PROMPT_PLACEHOLDER = "{{评分标准}}";

export type PromptDef = {
  id: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
};

// 内置提示词 = 改造前 ai.ts 里的 SYSTEM_PROMPT，保证初始化后的行为完全一致
const DEFAULT_PROMPT_CONTENT = `你是一名老师，正在批改试卷，你要批改的题有多个空。这是评分标准：
${PROMPT_PLACEHOLDER}

给你发答题卡的图片，你需要做：
1.识别出图片中每个空填写的内容(排除被划掉的内容，不要公式标记，禁止超过30字符，过长用省略号)
2.根据评分标准，判断每个空的得分
3.以[["1中识别出的内容",0(得分),"原因"],...]格式(根据评分标准中序号顺序)返回结果，其中原因不超过15字;识别出的内容完整返回`;

let cache: PromptDef[] | null = null;

function toDef(r: PromptRow): PromptDef {
  return {
    id: r.id,
    content: r.content,
    isDefault: r.isDefault !== 0,
    createdAt: r.createdAt,
  };
}

function ensureLoaded(): PromptDef[] {
  if (!cache) {
    if (countPromptRows() === 0) {
      const now = new Date().toISOString();
      insertPromptRow({
        id: randomUUID(),
        content: DEFAULT_PROMPT_CONTENT,
        isDefault: 1,
        createdAt: now,
      });
    }
    cache = listPromptRows().map(toDef);
  }
  return cache;
}

export function getAllPrompts(): PromptDef[] {
  return ensureLoaded();
}

// 当前生效的提示词：默认那条；数据异常（没有默认项）时回落到第一条，
// 再不行用内置提示词，保证改卷流程永远不会因为缺提示词而失败
export function getActivePromptContent(): string {
  const list = ensureLoaded();
  return (list.find((p) => p.isDefault) ?? list[0])?.content ?? DEFAULT_PROMPT_CONTENT;
}

export function createPrompt(content: string): PromptDef {
  const list = ensureLoaded();
  const prompt: PromptDef = {
    id: randomUUID(),
    content,
    // 正常情况下表里至少有内置的一条，这里只做兜底
    isDefault: list.length === 0,
    createdAt: new Date().toISOString(),
  };
  insertPromptRow({
    id: prompt.id,
    content: prompt.content,
    isDefault: prompt.isDefault ? 1 : 0,
    createdAt: prompt.createdAt,
  });
  list.push(prompt);
  return prompt;
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

  setAllPromptNotDefault();
  setPromptDefault(id);
  for (const p of list) p.isDefault = p.id === id;
  return target;
}
