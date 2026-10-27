import {
  listModelRows,
  countModelRows,
  insertModelRow,
  updateModelRow,
  setAllModelNotDefault,
  setModelDefault,
} from "../../db.ts";

// 模型定义 + 内存缓存。启动后首次访问从 model 表懒加载（表不存在时由
// initDb 的 CREATE TABLE IF NOT EXISTS 自动建），管理页改动写 DB 并同步缓存。
// getModelDef / getModels / resolveModel / resolveDetail 全部保持同步调用，
// 不把 ai.ts 的调用方改成 async。

export type ModelDef = {
  id: string;
  label: string;
  inputPrice: number;
  outputPrice: number;
  cacheHitPrice: number;
  detail: "low" | "high";
  enabled: boolean;
  isDefault: boolean;
};

export type ModelPatch = {
  label?: string;
  inputPrice?: number;
  outputPrice?: number;
  cacheHitPrice?: number;
  detail?: "low" | "high";
  enabled?: boolean;
};

const FALLBACK_DEFAULT_ID = "doubao-seed-2-0-lite-260428";

// 豆包官方常规档 [0,32k] 输入区间单价（元/百万 token），我们的评分 prompt 都落此档。
// cacheHitPrice 为「缓存命中输入」单价，官方计费公式见 ai.ts。
const DEFAULT_MODELS: Omit<ModelDef, "enabled" | "isDefault">[] = [
  { id: "doubao-seed-2-1-lite-260915", label: "doubao-seed-2-1-lite-260915", inputPrice: 0.8, outputPrice: 2.7, cacheHitPrice: 0.16, detail: "high" },
  { id: "doubao-seed-1-8-251228", label: "doubao-seed-1-8-251228", inputPrice: 0.8, outputPrice: 2.0, cacheHitPrice: 0.16, detail: "high" },
  { id: "doubao-seed-2-0-pro-260215", label: "doubao-seed-2-0-pro-260215", inputPrice: 3.2, outputPrice: 16.0, cacheHitPrice: 0.64, detail: "low" },
  { id: "doubao-seed-2-0-lite-260428", label: "doubao-seed-2-0-lite-260428", inputPrice: 0.6, outputPrice: 3.6, cacheHitPrice: 0.12, detail: "high" },
  { id: "doubao-seed-2-0-mini-260428", label: "doubao-seed-2-0-mini-260428", inputPrice: 0.2, outputPrice: 2.0, cacheHitPrice: 0.04, detail: "high" },
];

let cache: ModelDef[] | null = null;

function ensureLoaded(): ModelDef[] {
  if (!cache) {
    if (countModelRows() === 0) {
      const now = new Date().toISOString();
      for (const m of DEFAULT_MODELS) {
        insertModelRow({
          ...m,
          enabled: 1,
          isDefault: m.id === FALLBACK_DEFAULT_ID ? 1 : 0,
          updatedAt: now,
        });
      }
    }
    cache = listModelRows().map((r) => ({
      id: r.id,
      label: r.label,
      inputPrice: r.inputPrice,
      outputPrice: r.outputPrice,
      cacheHitPrice: r.cacheHitPrice,
      detail: r.detail,
      enabled: r.enabled !== 0,
      isDefault: r.isDefault !== 0,
    }));
  }
  return cache;
}

export function getModelDef(id: string): ModelDef | undefined {
  return ensureLoaded().find((m) => m.id === id);
}

export function getAllModels(): ModelDef[] {
  return ensureLoaded();
}

export function getModels(): { id: string; label: string }[] {
  return ensureLoaded()
    .filter((m) => m.enabled)
    .map(({ id, label }) => ({ id, label }));
}

export function resolveModel(model: string): string {
  if (model !== "auto") return model;
  const list = ensureLoaded();
  const def = list.find((m) => m.isDefault && m.enabled) ?? list.find((m) => m.isDefault);
  return def?.id ?? FALLBACK_DEFAULT_ID;
}

export function resolveDetail(model: string): "low" | "high" {
  return getModelDef(resolveModel(model))?.detail ?? "high";
}

export function saveModel(id: string, patch: ModelPatch): ModelDef {
  const list = ensureLoaded();
  const cur = list.find((m) => m.id === id);
  if (!cur) throw new Error(`模型不存在: ${id}`);
  const next: ModelDef = { ...cur, ...patch };
  updateModelRow({
    id,
    label: next.label,
    inputPrice: next.inputPrice,
    outputPrice: next.outputPrice,
    cacheHitPrice: next.cacheHitPrice,
    detail: next.detail,
    enabled: next.enabled ? 1 : 0,
    isDefault: next.isDefault ? 1 : 0,
    updatedAt: new Date().toISOString(),
  });
  list[list.findIndex((m) => m.id === id)] = next;
  return next;
}

export function setDefaultModel(id: string): ModelDef {
  const list = ensureLoaded();
  const target = list.find((m) => m.id === id);
  if (!target) throw new Error(`模型不存在: ${id}`);
  setAllModelNotDefault();
  setModelDefault(id);
  for (const m of list) m.isDefault = m.id === id;
  return target;
}
