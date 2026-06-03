import type { Api } from "@marking/server";

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  constructor(status: number, body?: { errorCode?: string; message?: string }) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.errorCode = body?.errorCode;
  }
}

const COMPRESS_THRESHOLD = 1024;

const isGetMethod = (path: string) =>
  !!path.split("/").pop()?.startsWith("get");

export const createHandler = (base: string, options?: {
  beforeRequest?: (req: Request) => Promise<Request>;
  beforeResponse?: (res: Response) => Promise<Response>;
}): Promisify<Api> => {
  return new Proxy(() => { }, {
    get(_target, p: string, _receiver) {
      let ret = createHandler(`${base}/${p as string}`, options);
      if (p === "makeRequest") {
        ret = createHandler(`${base}`, options);
        // @ts-ignore
        ret.isMakeRequest = true;
      }
      return ret;
    },
    apply: async (target: any, _thisArg, argArray) => {
      const isGet = isGetMethod(base);

      const bodyStr = isGet ? undefined : JSON.stringify(argArray);
      const headers = new Headers({ "content-type": "application/json" });

      let finalBody: BodyInit | undefined;
      if (bodyStr) {
        const encoded = new TextEncoder().encode(bodyStr);
        if (encoded.byteLength >= COMPRESS_THRESHOLD) {
          finalBody = await new Response(
            new Blob([encoded]).stream().pipeThrough(new CompressionStream("gzip"))
          ).arrayBuffer();
          headers.set("content-encoding", "gzip");
        } else {
          finalBody = bodyStr;
        }
      }

      let req: any = new Request(
        isGet
          ? `${base}?data=${encodeURIComponent(JSON.stringify(argArray) ?? '')}`
          : base,
        {
          method: isGet ? "GET" : "POST",
          headers,
          body: finalBody,
        }
      );
      if (options?.beforeRequest) req = await options.beforeRequest(req);
      if (target.isMakeRequest) return req;
      const res = await fetch(req);
      let r = options?.beforeResponse ? await options.beforeResponse(res) : res;
      if (r.status === 401) {
        // location.href = "/login";
      }
      if (!r.ok) {
        const isJson = r.headers.get("content-type")?.toLowerCase().startsWith("application/json");
        const body = isJson
          ? await r.json().catch(() => undefined)
          : { message: await r.text().catch(() => undefined) };
        throw new ApiError(r.status, body);
      }
      if (
        r.headers.get("content-type")?.toLowerCase().startsWith("application/json")
      ) {
        return r.json();
      }
      return r;
    },
  }) as any;
};
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...params: infer P) => infer R
  ? ((
    ...params: P
  ) => Promise<Awaited<R>>) & {
    makeRequest: (...params: P) => Promise<Request>;
  }
  : Promisify<T[K]>;
};


export const callWithFetchOption = async <
  const F extends ((...args: any) => any) & { makeRequest: (...args: Parameters<F>) => Promise<Request> }
>(
  fn: F,
  params: Parameters<F>,
  options: { signal?: AbortSignal }
): Promise<Awaited<ReturnType<F>>> => {
  const req = await fn.makeRequest(...params);
  const res = await fetch(req, options);
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.toLowerCase().startsWith("application/json");
    const body = isJson
      ? await res.json().catch(() => undefined)
      : { message: await res.text().catch(() => undefined) };
    throw new ApiError(res.status, body);
  }
  return res.json();
}

