import assert from "node:assert";
import * as api from "./index.ts";
import { ApiError, makeJsonResponse, makeJsonResponseApiError } from "./utils.ts";
import { logger } from "../logger.ts";
import { getInfo } from "../request-context.ts";

const parseFn = (req: Request): [fn: any, fnName: string] => {
  const pathname = new URL(req.url).pathname;
  const segs = pathname.split("/").slice(2);
  const fnName = segs[segs.length - 1];
  if (
    !(
      (fnName.startsWith("get") && req.method === "GET") ||
      req.method === "POST" ||
      fnName.startsWith("_out")
    )
  ) {
    return [null, fnName] as const;
  }
  const fn = segs.reduce((prev, curr) => (prev as any)?.[curr], api);
  return [fn, fnName] as const;
};

/**
 * This function should not throw error
 */
export const apiHandler = async (req: Request): Promise<Response> => {
  const [fn, fnName] = parseFn(req);
  if (!fn) {
    return makeJsonResponseApiError(new ApiError(404, "Not Found", {}, "API_NOT_FOUND", { url: req.url }));
  }
  let params: any = null;
  if (fnName.startsWith("_out")) {
    params = [req];
  } else {
    try {
      if (req.method === "POST") {
        params = await req.json();
        getInfo().perf.bodyReadTime = performance.now();
        logger.log(`[${getInfo().id}] body read: ${(performance.now() - getInfo().perf.startTime).toFixed(0)}ms`);
      } else if (req.method === "GET") {
        params = JSON.parse(new URL(req.url).searchParams.get("data") ?? "");
        getInfo().perf.bodyReadTime = performance.now();
        logger.log(`[${getInfo().id}] params read: ${(performance.now() - getInfo().perf.startTime).toFixed(0)}ms`);
      }
    } catch (e) {
      assert(e instanceof Error);
      logger.error(e);
      return makeJsonResponseApiError(new ApiError(400, e.message, {}, "API_BAD_REQUEST", {}));
    }
  }

  try {
    const info = getInfo();
    const ret = await fn(...params);
    if (ret instanceof Response) return ret;
    return makeJsonResponse(info.status, info.headers, ret);
  } catch (e) {
    logger.error(e);
    if (e instanceof ApiError) return makeJsonResponseApiError(e);
    return makeJsonResponseApiError(new ApiError(500, String(e), {}, "API_INTERNAL_ERROR", {}));
  }
};
