import { AsyncLocalStorage } from "node:async_hooks";
import type { OutgoingHttpHeaders } from "node:http";

export type Info = {
  request: Request;
  status: number;
  headers: ResponseInit["headers"];
};

export const als = new AsyncLocalStorage<Info>();

export const getInfo = () => als.getStore()!;

export const normalizeHeaders = (headers: OutgoingHttpHeaders): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v?.toString() ?? ""])
  );
};
