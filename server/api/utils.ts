export const succeed = {
  succeed: true,
};

export class ApiError extends Error {
  public status: number;
  public headers: ResponseInit["headers"];
  public errorCode: string;
  public extraData?: Record<string, unknown>;
  constructor(
    status: number,
    message: string,
    headers: ResponseInit["headers"] = {},
    errorCode: string = "API_ERROR",
    extraData?: Record<string, unknown>,
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

export const makeJsonResponseApiError = (err: ApiError): Response => {
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
    throw new ApiError(status, msg);
  }
}
