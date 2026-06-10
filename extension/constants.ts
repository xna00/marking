export enum storageKeys {
  // 用户设置和偏好
  USER_SETTINGS = "userSettings",
  AI_CONFIG = "aiConfig",
  API_KEY = "apiKey",
  AI_MODEL = "aiModel_v2",
  AI_PROMPT = "aiSystemPrompt_v2",
  IMAGE_SRC = "imageSrc",

  // 评分标准和规则
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
}

export const HOST = "https://marking.xna00.top";

export const BACKEND_URL = "http://api.marking.xna00.top:3000";

export const EXTENSION_VERSION = import.meta.env.VITE_EXTENSION_VERSION;

export function shouldReloadOnMismatch(storedSentinel: string | undefined): boolean {
  return storedSentinel !== chrome.runtime.getManifest().version;
}

// 存储键的类型定义
export type ChromeStorageKey = `${storageKeys}`;
