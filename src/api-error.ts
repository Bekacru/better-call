export class APIError extends Error {
  constructor(
    public message: string,
    public status: number = 500,
    public code: string = "INTERNAL_SERVER_ERROR",
    public headers = {}
  ) {
    super(message);
    this.name = "APIError";
    this.message = message;
    this.status = status;
    this.code = code;
    this.headers = headers;
    this.stack = "";
  }
}
