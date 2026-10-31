import { brotliCompressSync, gzipSync, constants } from "node:zlib";
import { getInfo } from "../request-context.ts";

export const succeed = {
  succeed: true,
};


type ErrorCodeExtraDataMap = {
  "API_AI_FAILED": { rawContent?: string },
  "API_NOT_FOUND": { url: string },
  "API_INTERNAL_ERROR": {},
  "API_BAD_REQUEST": {},
  "API_FORBIDDEN": {},
  "API_UNAUTHORIZED": {},
  "API_INSUFFICIENT_CREDITS": {},
}

type ApiErrorC<K> = K extends keyof ErrorCodeExtraDataMap ? { errorCode: K, message: string } & ErrorCodeExtraDataMap[K] : never

export type ApiErrorType = ApiErrorC<keyof ErrorCodeExtraDataMap>

export class ApiError<const E extends keyof ErrorCodeExtraDataMap> extends Error {
  public status: number;
  public headers: ResponseInit["headers"];
  public errorCode: E;
  public extraData: ErrorCodeExtraDataMap[E];
  constructor(
    status: number,
    message: string,
    headers: ResponseInit["headers"] = {},
    errorCode: E,
    extraData: ErrorCodeExtraDataMap[E],
  ) {
    super(message);
    this.status = status;
    this.headers = headers;
    this.errorCode = errorCode;
    this.extraData = extraData;
  }
}

type ContentEncoding = "br" | "gzip";

// 小于这个长度压缩收益不抵开销，直接发明文
const MIN_COMPRESS_SIZE = 1024;

// accept-encoding 里的顺序不代表优先级（真正的优先级看 q=），所以显式按 br > gzip 挑
const pickEncoding = (acceptEncoding: string | null): ContentEncoding | null => {
  if (!acceptEncoding) return null;
  let br = false;
  let gzip = false;
  for (const part of acceptEncoding.split(",")) {
    const [rawToken, ...params] = part.split(";");
    const token = rawToken.trim().toLowerCase();
    if (!token) continue;
    let quality = 1;
    for (const param of params) {
      const [key, value] = param.split("=");
      if (key?.trim().toLowerCase() === "q") quality = Number(value);
    }
    // q=0 表示客户端明确拒收
    if (!(quality > 0)) continue;
    if (token === "br") br = true;
    else if (token === "gzip") gzip = true;
  }
  if (br) return "br";
  if (gzip) return "gzip";
  return null;
};

// br 必须显式降 quality：默认 11 对 100KB 要几十毫秒，q5 只要 1ms 内且压缩率更好
const compress = (body: Uint8Array, encoding: ContentEncoding): Uint8Array =>
  encoding === "br"
    ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
    : gzipSync(body, { level: 6 });

const setVaryAcceptEncoding = (headers: Headers) => {
  const vary = headers.get("vary");
  if (!vary) headers.set("vary", "accept-encoding");
  else if (!/\baccept-encoding\b/i.test(vary)) headers.set("vary", `${vary}, accept-encoding`);
};

export const makeJsonResponse = (
  status: number,
  _headers: ResponseInit["headers"],
  obj: object,
): Response => {
  const bodyStr = JSON.stringify(obj);
  const raw = new TextEncoder().encode(bodyStr);
  const headers = new Headers(_headers);
  headers.delete("content-type");
  headers.delete("content-length");
  headers.set("content-type", "application/json");

  // ALS 里存着原始 Request，在这里读 accept-encoding
  const acceptEncoding = getInfo().request.headers.get("accept-encoding");
  const encoding = headers.has("content-encoding") ? null : pickEncoding(acceptEncoding);
  const compressed = encoding && raw.length >= MIN_COMPRESS_SIZE ? compress(raw, encoding) : null;

  // 压缩后反而更大（极小 payload / 高熵内容）就回退明文
  if (encoding && compressed && compressed.length < raw.length) {
    setVaryAcceptEncoding(headers);
    headers.set("content-encoding", encoding);
    headers.set("content-length", String(compressed.length));
    return new Response(compressed, { status, headers });
  }

  headers.set("content-length", raw.length.toString());
  return new Response(raw, { status, headers });
};

export const makeJsonResponse200 = makeJsonResponse.bind(null, 200);

export const makeJsonResponseApiError = (err: ApiError<any>): Response => {
  const obj: { errorCode: string; message: string } & Record<string, unknown> = {
    errorCode: err.errorCode,
    message: err.message,
  };
  if (err.extraData) Object.assign(obj, err.extraData);
  return makeJsonResponse(err.status, err.headers, obj);
};

export function assertApiError<T>(
  v: T,
  msg: string,
  status = 500,
): asserts v is Exclude<T, undefined> {
  if (v === undefined) {
    throw new ApiError(status, msg, {}, "API_INTERNAL_ERROR", {});
  }
}
