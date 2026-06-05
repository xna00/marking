import assert from "node:assert";
import { als, type Info } from "./global.ts";
import * as api from "./index.ts";
import { ApiError, makeJsonResponse, makeJsonResponseApiError } from "./utils.ts";
import { logger } from "../logger.ts";

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

export const apiHandler = async (req: Request): Promise<Response> => {
  let res: Response;

  const [fn, fnName] = parseFn(req);
  if (!fn) {
    res = makeJsonResponseApiError(404, {}, { errorCode: "API_NOT_FOUND", message: "Not Found", url: req.url });
    return res;
  }
  let params: any = null;
  if (fnName.startsWith("_out")) {
    params = [req];
  } else {
    try {
      if (req.method === "POST") params = await req.json();
      else if (req.method === "GET")
        params = JSON.parse(new URL(req.url).searchParams.get("data") ?? "");
    } catch (e) {
      assert(e instanceof Error);
      logger.error(e);
      res = makeJsonResponseApiError(400, {}, { errorCode: "BAD_REQUEST", message: e.message });
      return res;
    }
  }

  const info: Info = { request: req, status: 200, headers: {} };
  return als.run(info, async () => {
    try {
      const ret = await fn(...params);
      if (ret instanceof Response) return ret;
      return makeJsonResponse(info.status, info.headers, ret);
    } catch (e) {
      logger.error(e);
      if (e instanceof ApiError) {
        return makeJsonResponseApiError(e.status, e.headers, { errorCode: e.errorCode, message: e.message });
      }
      return makeJsonResponseApiError(500, {}, { errorCode: "API_ERROR", message: String(e) });
    }
  });
};
