import type { ZodError } from "zod";
import type { EndpointContext } from "./context";
import type { EndpointOptions } from "./options";

export interface JSONResponse<R = any> {
  /**
   * Body of the response
   * It'll be inferred as the response body.
   * and on the server side this will be returned
   * as a response of a handler.
   */
  body: R;
  /**
   * The actual response object
   */
  routerResponse: {
    body?: Record<string, any>;
    status?: number;
    headers?: Record<string, string>;
  };
  /**
   * Flag to identify the response type
   */
  _flag: "json";
}

export type EndpointResponse =
  | JSONResponse
  | Response
  | void
  | Record<string, any>
  | null;

export type InferResponse<Ctx, R> = Ctx extends { asResponse: true }
  ? Response
  : R extends JSONResponse<infer T>
  ? T
  : R;

type ValidationResponse =
  | {
      data: {
        body: any;
        query: any;
      };
      error: null;
    }
  | {
      data: null;
      error: {
        message: string;
      };
    };

export function runValidation(
  options: EndpointOptions,
  context: EndpointContext<any, any>
): ValidationResponse {
  let request = {
    body: undefined,
    query: undefined,
  } as {
    body: any;
    query: any;
  };
  if (options.body) {
    const result = options.body.safeParse(context.body);
    if (result.error) {
      return {
        data: null,
        error: fromError(result.error),
      };
    }
    request.body = result.data;
  }
  if (options.query) {
    const result = options.query.safeParse(context.query);
    if (result.error) {
      return {
        data: null,
        error: fromError(result.error),
      };
    }
    request.query = result.data;
  }
  if (options.requireHeaders && !(context.headers instanceof Headers)) {
    return {
      data: null,
      error: { message: "Validation Error: Headers are required" },
    };
  }
  if (options.requireRequest && !context.request) {
    return {
      data: null,
      error: { message: "Validation Error: Request is required" },
    };
  }
  return {
    data: request,
    error: null,
  };
}

export function fromError(error: ZodError) {
  const errorMessages: string[] = [];

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    const message = issue.message;

    if (path) {
      errorMessages.push(`${message} at "${path}"`);
    } else {
      errorMessages.push(message);
    }
  }
  return {
    message: `Validation error: ${errorMessages.join(", ")}`,
  };
}
