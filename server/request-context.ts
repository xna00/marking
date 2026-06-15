import { AsyncLocalStorage } from "node:async_hooks";

export type RequestInfo = {
  request: Request;
  status: number;
  headers: ResponseInit["headers"];
};

export const als = new AsyncLocalStorage<RequestInfo>();

export const getInfo = () => als.getStore()!;
