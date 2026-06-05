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

export const makeJsonResponse = (
  status: number,
  _headers: ResponseInit["headers"],
  obj: object,
): Response => {
  const bodyStr = JSON.stringify(obj);
  const body = new TextEncoder().encode(bodyStr);
  const headers = new Headers(_headers);
  headers.delete("content-type");
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  headers.set("content-length", body.length.toString());
  return new Response(body, { status, headers });
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
