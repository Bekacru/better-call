import type { BufferSource } from "stream/web";
import type {
  CookieOptions,
  CookiePrefixOptions,
} from "./cookies/cookie-utils";
import type { Input } from "./helper";
import type {
  EndpointOptions,
  InferBody,
  InferHeaders,
  InferMethod,
  InferParam,
  InferQuery,
  InferRequest,
  InferUse,
  Method,
} from "./options";
import type { APIError } from "./api-error";

export interface EndpointContext<
  Path extends string,
  Options extends EndpointOptions
> {
  /**
   * JSON
   *
   * a helper function to create a JSON response with the correct headers
   * and status code. If `asResponse` is set to true in the context then
   * it will return a Response object instead of the JSON object.
   *
   * @param json - The JSON object to return
   * @param routerResponse - The response object to return if `asResponse` is
   * true in the context this will take precedence
   */
  json: <R extends Record<string, any>>(
    json: R,
    routerResponse?:
      | {
          status?: number;
          headers?: Record<string, string>;
          response?: Response;
        }
      | Response
  ) => Promise<R>;
  /**
   * Body
   *
   * The body object will be the parsed JSON from the request and validated
   * against the body schema if it exists
   */
  body: InferBody<Options>;
  /**
   * Path
   *
   * The path of the endpoint
   */
  path: Path;
  /**
   * Method
   */
  method: InferMethod<Options>;
  /**
   * Query
   *
   * The query object will be the parsed query string from the request
   * and validated against the query schema if it exists
   */
  query: InferQuery<Options>;
  /**
   * Params
   *
   * If the path is `/user/:id` and the request is `/user/1` then the params will
   * be `{ id: "1" }` and if the path includes a wildcard like `/user/*` then the
   * params will be `{ _: "1" }` where `_` is the wildcard key. If the wildcard
   * is named like `/user/**:name` then the params will be `{ name: string }`
   */
  params: InferParam<Path>;
  /**
   * Request object
   *
   * If `requireRequest` is set to true in the endpoint options this will be
   * required
   */
  request: InferRequest<Options>;
  /**
   * Headers
   *
   * If `requireHeaders` is set to true in the endpoint options this will be
   * required
   */
  headers: InferHeaders<Options>;
  /**
   * Middleware context
   */
  context: InferUse<Options["use"]>;
  /**
   * Set header
   *
   * If it's called outside of a request it will just be ignored.
   */
  setHeader: (key: string, value: string) => void;
  /**
   * Get header
   *
   * If it's called outside of a request it will just return null
   *
   * @param key  - The key of the header
   * @returns
   */
  getHeader: (key: string) => string | null;

  /**
   * cookie setter.
   *
   * If it's called outside of a request it will just be ignored.
   */
  setCookie: (key: string, value: string, options?: CookieOptions) => void;
  /**
   * Get cookie value
   *
   * If it's called outside of a request it will just be ignored.
   */
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | undefined;
  /**
   * Set signed cookie
   */
  setSignedCookie: (
    key: string,
    value: string,
    secret: string | BufferSource,
    options?: CookieOptions
  ) => Promise<void>;
  /**
   * Get signed cookie value
   */
  getSignedCookie: (
    key: string,
    secret: string,
    prefix?: CookiePrefixOptions
  ) => Promise<string | undefined | false>;
  /**
   * Redirect to url
   */
  redirect: (url: string) => APIError;
}

export type Context<
  Path extends string,
  Options extends EndpointOptions
> = Input<{
  body: InferBody<Options>;
  method?: InferMethod<Options>;
  query: InferQuery<Options>;
  params: InferParam<Path>;
  request: InferRequest<Options>;
  headers: InferHeaders<Options>;
  asResponse?: boolean;
}>;

export function createSetHeader(headers: Headers) {
  return (key: string, value: string) => {
    headers.set(key, value);
  };
}

export function createGetHeader(headers: Headers) {
  return (key: string) => {
    return headers.get(key);
  };
}
