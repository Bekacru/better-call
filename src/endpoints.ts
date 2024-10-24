import { createJSON, runValidation, type EndpointResponse } from "./response";
import { createSetHeader, type Context, type EndpointContext } from "./context";
import type { EndpointOptions } from "./options";
import type { HasRequiredKeys } from "./helper";
import { APIError } from "./api-error";
import {
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
} from "./cookies";
import type { CookieOptions } from "./cookies/utils";

const createResponse = (handlerResponse: any, response: Response) => {
  if (handlerResponse instanceof Response) {
    response.headers.forEach((value, key) => {
      handlerResponse.headers.set(key, value);
    });
    return handlerResponse;
  } else if (handlerResponse?._flag === "json") {
    const responseObj = new Response(
      JSON.stringify(
        handlerResponse.routerResponse?.body || handlerResponse.body
      ),
      {
        status: handlerResponse.routerResponse?.status || 200,
        headers: handlerResponse.routerResponse?.headers,
      }
    );
    response.headers.forEach((value, key) => {
      responseObj.headers.set(key, value);
    });
    return responseObj;
  } else {
    const responseObj = new Response(
      handlerResponse ? JSON.stringify(handlerResponse) : undefined
    );
    response.headers.forEach((value, key) => {
      responseObj.headers.set(key, value);
    });
    return responseObj;
  }
};

export const createEndpoint = <
  Path extends string,
  Options extends EndpointOptions,
  R extends EndpointResponse
>(
  path: Path,
  options: Options,
  handler: (context: EndpointContext<Path, Options>) => Promise<R>
) => {
  const internalHandler = async <Ctx extends Context<Path, Options>>(
    ...inputCtx: HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]
  ) => {
    let response = new Response();
    const { asResponse, ...ctx } = inputCtx[0] || {};
    const data = runValidation(options, ctx as any);
    if (data.error) {
      throw new APIError(data.error.message, 400);
    }
    const context: EndpointContext<Path, Options> = {
      json: createJSON({
        asResponse,
        response,
      }) as any,
      body: "body" in data ? (data.body as any) : undefined,
      path,
      query: "query" in data ? (data.query as any) : undefined,
      params: "params" in ctx ? (ctx.params as any) : undefined,
      headers: "headers" in ctx ? (ctx.headers as any) : undefined,
      request: "request" in ctx ? (ctx.request as any) : undefined,
      setHeader: createSetHeader(response.headers),
      getHeader: (key: string) => {
        const requestHeaders: Headers | null =
          "headers" in ctx && ctx.headers instanceof Headers
            ? ctx.headers
            : "request" in ctx && ctx.request instanceof Request
            ? ctx.request.headers
            : null;
        if (!requestHeaders) return null;
        return requestHeaders.get(key);
      },
      setCookie: (name: string, value: string, options?: CookieOptions) => {
        setCookie(response.headers, name, value, options);
      },
      getCookie(key, prefix) {
        const headers = context.headers?.get("cookie");
        if (!headers) return undefined;
        return getCookie(headers, key, prefix);
      },
      setSignedCookie(key, value, secret, options) {
        return setSignedCookie(response.headers, key, value, secret, options);
      },
      async getSignedCookie(key, secret, prefix) {
        const headers = context.headers;
        if (!headers) return undefined;
        return getSignedCookie(headers, secret, key, prefix);
      },
      redirect: (url: string) => {
        const apiError = new APIError("Redirecting", "", 302, "FOUND", {
          Location: url,
          ...response.headers,
        });
        return apiError;
      },
    };
    const handlerResponse = (await handler(context)) as EndpointResponse;
    response = createResponse(handlerResponse, response);
    const res = asResponse ? response : handlerResponse;
    return res as Ctx["asResponse"] extends true ? Response : R;
  };
  return internalHandler;
};
