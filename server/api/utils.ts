export const succeed = {
  succeed: true,
};

export class ApiError extends Error {
  public status: number;
  public headers: ResponseInit["headers"];
  public errorCode?: string;
  constructor(
    status: number,
    headers: ResponseInit["headers"],
    message: string,
    errorCode?: string,
  ) {
    super(message);
    this.status = status;
    this.headers = headers;
    this.errorCode = errorCode;
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

export function assertApiError<T>(
  v: T,
  msg: string,
  status = 500,
): asserts v is Exclude<T, undefined> {
  if (v === undefined) {
    throw new ApiError(status, {}, msg);
  }
}
