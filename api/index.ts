import type { Api } from "@marking/server";
import type { ApiErrorType } from "@marking/server";

export class ApiError extends Error {
  status: number;
  body?: ApiErrorType;

  constructor(status: number, body?: object) {
    super((body as { message?: string })?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.body = body as ApiErrorType | undefined;
  }
}

const COMPRESS_THRESHOLD = 1024;

const isGetMethod = (path: string) =>
  !!path.split("/").pop()?.startsWith("get");

type FetchOptions = Omit<RequestInit, "body" | "method" | "headers">;

export const createHandler = (base: string, options?: {
  fetcher?: (req: Request, init?: FetchOptions) => Promise<Response>;
  fetchOptions?: FetchOptions;
}): Promisify<Api> => {
  return new Proxy(() => { }, {
    get(_target, p: string, _receiver) {
      if (p === "withOptions") {
        return (fetchOptions: FetchOptions) =>
          createHandler(base, { ...options, fetchOptions });
      }
      let ret = createHandler(`${base}/${p as string}`, options);
      if (p === "makeRequest") {
        ret = createHandler(`${base}`, options);
        // @ts-ignore
        ret.isMakeRequest = true;
      }
      return ret;
    },
    apply: (target: any, _thisArg, argArray) => {
      const isGet = isGetMethod(base);

      const bodyStr = isGet ? undefined : JSON.stringify(argArray);
      const headers = new Headers({ "content-type": "application/json" });
      const url = isGet
        ? `${base}?data=${encodeURIComponent(JSON.stringify(argArray) ?? '')}`
        : base;

      // makeRequest 只是用来拿 URL，同步构造即可；POST 的 body 不做 gzip（压缩需要异步流）
      if (target.isMakeRequest) {
        return new Request(url, {
          method: isGet ? "GET" : "POST",
          headers,
          body: bodyStr ?? null,
        });
      }

      return (async () => {
        let finalBody: BodyInit | undefined;
        if (bodyStr) {
          const bodyBlob = new Blob([bodyStr]);
          if (bodyBlob.size >= COMPRESS_THRESHOLD) {
            finalBody = await new Response(
              bodyBlob.stream().pipeThrough(new CompressionStream("gzip"))
            ).arrayBuffer();
            headers.set("content-encoding", "gzip");
          } else {
            finalBody = bodyStr;
          }
        }

        const req = new Request(url, {
          method: isGet ? "GET" : "POST",
          headers,
          body: finalBody,
        });
        const r = options?.fetcher
          ? await options.fetcher(req, options.fetchOptions)
          : await fetch(req, options?.fetchOptions);
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
      })();
    },
  }) as any;
};
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...params: infer P) => infer R
  ? ((
    ...params: P
  ) => Promise<Awaited<R>>) & {
    makeRequest: (...params: P) => Request;
    withOptions: (fetchOptions: FetchOptions) => (...params: P) => Promise<Awaited<R>>;
  }
  : Promisify<T[K]>;
};

