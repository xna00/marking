import type { Api } from "@marking/server";

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
      let req: any = new Request(
        isGet
          ? `${base}?data=${encodeURIComponent(JSON.stringify(argArray) ?? '')}`
          : base,
        {
          method: isGet ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
          },
          body: isGet ? undefined : JSON.stringify(argArray),
        }
      );
      if (options?.beforeRequest) req = await options.beforeRequest(req);
      if (target.isMakeRequest) return req;
      return fetch(req).then(async (res) => {
        if (options?.beforeResponse) res = await options.beforeResponse(res);
        if (res.status === 401) {
          // location.href = "/login";
        }
        if (
          res.headers.get("content-type")?.toLowerCase() === "application/json"
        ) {
          return res.json();
        }
        return res;
      });
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


export const callWithFetchOption =
  <const F extends ((...args: any) => any) & { makeRequest: (...args: Parameters<F>) => Promise<Request> }>
    (fn: F, params: Parameters<F>, options: { signal?: AbortSignal }): ReturnType<F> => {
    return fn.makeRequest(...params).then(req => fetch(req, options)).then(res => res.json()) as ReturnType<F>
  }

