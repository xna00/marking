import { AsyncLocalStorage } from "node:async_hooks";

export type RequestInfo = {
  id: number;
  request: Request;
  status: number;
  headers: ResponseInit["headers"];
};

export const als = new AsyncLocalStorage<RequestInfo>();

export const getInfo = () => als.getStore()!;

let nextId = 1;

export function createRequestInfo(request: Request): RequestInfo {
  return { id: nextId++, request, status: 200, headers: {} };
}
