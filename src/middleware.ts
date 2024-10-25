import type { EndpointContext } from "./context";
import { createEndpoint, type Endpoint } from "./endpoints";
import type { EndpointOptions } from "./options";
import type { EndpointResponse } from "./response";

type MiddlewareHandler<
  Options extends EndpointOptions,
  R extends EndpointResponse
> = (context: EndpointContext<any, Options>) => Promise<R>;

export function createMiddleware<
  Opts extends EndpointOptions,
  R extends EndpointResponse
>(
  optionsOrHandler: MiddlewareHandler<Opts, R>
): Endpoint<MiddlewareHandler<Opts, R>, Opts>;
export function createMiddleware<
  Opts extends EndpointOptions,
  R extends EndpointResponse
>(
  optionsOrHandler: Opts,
  handler: MiddlewareHandler<Opts, R>
): Endpoint<MiddlewareHandler<Opts, R>, Opts>;
export function createMiddleware(optionsOrHandler: any, handler?: any) {
  if (typeof optionsOrHandler === "function") {
    return createEndpoint(
      "*",
      {
        method: "*",
      },
      optionsOrHandler
    );
  }
  if (!handler) {
    throw new Error("Middleware handler is required");
  }
  const endpoint = createEndpoint(
    "*",
    {
      ...optionsOrHandler,
      method: "*",
    },
    handler
  );
  return endpoint as any;
}
