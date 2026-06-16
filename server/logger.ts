import { getInfo } from "./request-context.ts";

export const logger = {
  log: (...args: unknown[]) => console.log(`[${new Date().toLocaleString("zh-CN")}]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${new Date().toLocaleString("zh-CN")}]`, ...args),
  error: (...args: unknown[]) => console.error(`[${new Date().toLocaleString("zh-CN")}]`, ...args),
  logWithId: (...args: unknown[]) => {
    const info = getInfo();
    console.log(`[${new Date().toLocaleString("zh-CN")}] [${info.id}]`, ...args);
  },
};
