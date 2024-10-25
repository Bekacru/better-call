import {
  createRouter as createRou3Router,
  addRoute,
  findRoute,
  findAllRoutes,
} from "rou3";
import type { Endpoint } from "./endpoints";
import { APIError } from "./api-error";
import { getBody } from "./utils";

interface RouterConfig {
  /**
   * Throw error if error occurred other than APIError
   */
  throwError?: boolean;
  /**
   * Handle error
   */
  onError?: (e: unknown) => void | Promise<void> | Response | Promise<Response>;
  /**
   * Base path for the router
   */
  basePath?: string;
  /**
   * Middlewares for the router
   */
  routerMiddleware?: {
    path: string;
    middleware: Endpoint;
  }[];
  /**
   * On response interceptor
   */
  onResponse?: (res: Response) => any | Promise<any>;
  /**
   * On request interceptor
   */
  onRequest?: (req: Request) => any | Promise<any>;
  /**
   * Extra context to pass to the handler
   */
  extraContext?: Record<string, any>;
}

export const createRouter = <
  E extends Record<string, Endpoint>,
  Config extends RouterConfig
>(
  endpoints: E,
  config?: Config
) => {
  const _endpoints = Object.values(endpoints);
  const router = createRou3Router();
  for (const endpoint of _endpoints) {
    if (Array.isArray(endpoint.options?.method)) {
      for (const method of endpoint.options.method) {
        addRoute(router, method, endpoint.path, endpoint);
      }
    } else {
      addRoute(router, endpoint.options.method, endpoint.path, endpoint);
    }
  }
  const middlewareRouter = createRou3Router();
  for (const route of config?.routerMiddleware || []) {
    addRoute(middlewareRouter, "*", route.path, route.middleware);
  }
  const handler = async (request: Request) => {
    const url = new URL(request.url);
    let path = url.pathname;
    if (config?.basePath) {
      path = path.split(config.basePath)[1];
    }
    if (!path?.length) {
      config?.onError?.(new APIError("NOT_FOUND"));
      console.warn(
        `[better-call]: Make sure the URL has the basePath (${config?.basePath}).`
      );
      return new Response(null, {
        status: 404,
        statusText: "Not Found",
      });
    }
    const method = request.method;
    const route = findRoute(router, method, path);
    const handler = route?.data as Endpoint;
    const body = await getBody(request);
    const headers = request.headers;
    const query = Object.fromEntries(url.searchParams);
    const routerMiddleware = findAllRoutes(middlewareRouter, "*", path);
    //handler 404
    if (!handler) {
      return new Response(null, {
        status: 404,
        statusText: "Not Found",
      });
    }
    try {
      let middlewareContext: Record<string, any> = {};
      if (routerMiddleware?.length) {
        for (const route of routerMiddleware) {
          const middleware = route.data as Endpoint;
          const res = await middleware({
            path: path,
            method: method as "GET",
            headers,
            params: route?.params as any,
            request: request,
            body: body,
            query,
            context: {
              ...config?.extraContext,
            },
          });
          if (res instanceof Response) {
            return res;
          }
          if (res?._flag === "json") {
            return new Response(JSON.stringify(res), {
              headers: res.headers,
            });
          }
          if (res) {
            middlewareContext = {
              ...res,
              ...middlewareContext,
            };
          }
        }
      }
      const handlerRes = await handler({
        path: path,
        method: method as "GET",
        headers,
        params: route?.params as any,
        request: request,
        body: body,
        query,
        context: {
          ...middlewareContext,
          ...config?.extraContext,
        },
        asResponse: true,
      });
      if (handlerRes instanceof Response) {
        return handlerRes;
      }
      return new Response(handlerRes ? JSON.stringify(handlerRes) : undefined, {
        status: 200,
      });
    } catch (e) {
      if (config?.onError) {
        const onErrorRes = await config.onError(e);
        if (onErrorRes instanceof Response) {
          return onErrorRes;
        }
      }
      if (e instanceof APIError) {
        return new Response(
          e.message
            ? JSON.stringify({
                message: e.message,
                code: e.code,
              })
            : null,
          {
            status: e.status,
            headers: e.headers,
          }
        );
      }
      if (config?.throwError) {
        throw e;
      }
      return new Response(null, {
        status: 500,
        statusText: "Internal Server Error",
      });
    }
  };
  return {
    handler,
    endpoints,
  };
};
