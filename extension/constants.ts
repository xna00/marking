import type { ModelName, ConfigItem } from "./models";

export enum storageKeys {
  // 用户设置和偏好
  USER_SETTINGS = "userSettings",
  AI_CONFIG = "aiConfig",
  API_KEY = "apiKey",
  AI_MODEL = "aiModel",
  AI_PROMPT = "aiSystemPrompt",
  IMAGE_SRC = "imageSrc",

  // 评分标准和规则
  CRITERIA_CONFIG = "criteriaConfig",
  CRITERIA_RULES = "criteriaRules_v1",
  DEFAULT_CRITERIA = "defaultCriteria",
  CRITERIA_HEADER = "criteriaHeader",
  CRITERIA_TABLE_CELL_SIZE = "criteriaTableCellSize",
  COLS_WIDTH = "colsWidth",
  ROWS_HEIGHT = "rowsHeight",

  // 标记数据
  PAGE_MARKS = "pageMarks",
  MARK_HISTORY = "markHistory",

  // 统计数据
  STATISTICS = "statistics",
  USAGE_STATS = "usageStats",

  // 临时数据
  TEMP_DATA = "tempData",
  SESSION_DATA = "sessionData",

  // 扩展状态
  EXTENSION_STATUS = "extensionStatus",
  LAST_SYNC = "lastSync",

  // AI 结果延迟
  AI_DELAY = "aiDelay",

  // 缓存数据
  CACHE_DATA = "cacheData",
  IMAGE_CACHE = "imageCache",

  // localStorage 键（用于内容脚本）
  DIV_POSITIONS = "div_positions",
  TOTAL_SCORE = "total_score",


  UPDATE_INFO = "updateInfo",

  // 登录
  AUTH_TOKEN = "authToken",
}

export const HOST = "https://marking.xna00.top";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// 存储键的类型定义
export type ChromeStorageKey = `${storageKeys}`;

// 存储 schema：key → value 类型映射
export type StorageSchema = {
  [storageKeys.AI_MODEL]?: ModelName;
  [storageKeys.CRITERIA_CONFIG]?: ConfigItem[];
  [storageKeys.AI_DELAY]?: [number, number];
  [storageKeys.AUTH_TOKEN]?: string;
  [storageKeys.IMAGE_SRC]?: string;
};
