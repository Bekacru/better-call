import type { ZodSchema } from "zod";
import type { IsEmptyObject, Prettify, UnionToIntersection } from "./helper";
import type { Endpoint } from "./endpoints";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "*";

export interface EndpointOptions {
  /**
   * Request Method
   */
  method: Method | Method[];
  /**
   * Body Schema
   */
  body?: ZodSchema;
  /**
   * Query Schema
   */
  query?: ZodSchema;
  /**
   * If true headers will be required to be passed in the context
   */
  requireHeaders?: boolean;
  /**
   * If true request object will be required
   */
  requireRequest?: boolean;
  /**
   * Endpoint metadata
   */
  metadata?: Record<string, any>;
  /**
   * Middleware to use
   */
  use?: Endpoint[];
}

export type InferBody<Options extends EndpointOptions> =
  Options["body"] extends ZodSchema<infer T> ? T : never;

export type InferQuery<Options extends EndpointOptions> =
  Options["query"] extends ZodSchema<infer T> ? T : never;

export type InferParamPath<Path> =
  Path extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof InferParamPath<Rest>]: string }
    : Path extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : Path extends `${infer _Start}/${infer Rest}`
    ? InferParamPath<Rest>
    : {};

export type InferParamWildCard<Path> = Path extends
  | `${infer _Start}/*:${infer Param}/${infer Rest}`
  | `${infer _Start}/**:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof InferParamPath<Rest>]: string }
  : Path extends `${infer _Start}/*`
  ? { [K in "_"]: string }
  : Path extends `${infer _Start}/${infer Rest}`
  ? InferParamPath<Rest>
  : {};

export type InferParam<Path extends string> = IsEmptyObject<
  InferParamPath<Path> & InferParamWildCard<Path>
> extends true
  ? never
  : Prettify<InferParamPath<Path> & InferParamWildCard<Path>>;

export type InferRequest<Option extends EndpointOptions> =
  Option["requireRequest"] extends true ? Request : Request | undefined;

export type InferHeaders<Option extends EndpointOptions> =
  Option["requireHeaders"] extends true ? Headers : Headers | undefined;

export type InferUse<Opts extends EndpointOptions["use"]> =
  Opts extends Endpoint[]
    ? UnionToIntersection<Awaited<ReturnType<Opts[number]>>>
    : never;
