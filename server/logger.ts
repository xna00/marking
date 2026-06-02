export const logger = {
  log: (...args: unknown[]) => console.log(`[${new Date().toLocaleString()}]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${new Date().toLocaleString()}]`, ...args),
  error: (...args: unknown[]) => console.error(`[${new Date().toLocaleString()}]`, ...args),
};
