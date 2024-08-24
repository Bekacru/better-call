import { createRouter as createRou3Router, addRoute, findRoute } from "rou3";
import { getBody, shouldSerialize, statusCode } from "./utils";
import { APIError } from "./error";
import type { Middleware, MiddlewareHandler } from "./middleware";
import type { Endpoint, EndpointResponse, Method } from "./types";

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
	extraContext?: Record<string, any>;
	transformResponse?: (res: Response) => Response | Promise<Response>;
	transformRequest?: (req: Request) => Request | Promise<Request>;
}

export const createRouter = <E extends Record<string, Endpoint>, Config extends RouterConfig>(
	endpoints: E,
	config?: Config,
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
		const method = request.method;
		const route = findRoute(router, method, path);
		const handler = route?.data as Endpoint;
		const body = await getBody(request);
		const headers = request.headers;
		const query = Object.fromEntries(url.searchParams);
		const middleware = findRoute(middlewareRouter, "*", path)?.data as Endpoint | undefined;
		//handler 404
		if (!handler) {
			return new Response(null, {
				status: 404,
				statusText: "Not Found",
			});
		}
		try {
			let middlewareContext: Record<string, any> = {};
			if (middleware) {
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
			const handlerRes = await handler({
				path: path,
				method: method as "GET",
				headers,
				params: route?.params as any,
				request: request,
				body: body,
				query,
				_flag: "router",
				context: {
					...middlewareContext,
					...config?.extraContext,
				},
			});
			if (handlerRes instanceof Response) {
				return handlerRes;
			}
			const resBody = shouldSerialize(handlerRes) ? JSON.stringify(handlerRes) : handlerRes;
			return new Response(resBody as any, {
				headers: handler.headers,
			});
		} catch (e) {
			if (config?.onError) {
				const onErrorRes = await config.onError(e);
				if (onErrorRes instanceof Response) {
					return onErrorRes;
				}
			}
			if (e instanceof APIError) {
				return new Response(e.body ? JSON.stringify(e.body) : null, {
					status: statusCode[e.status],
					statusText: e.status,
					headers: handler.headers,
				});
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
		handler: async (request: Request) => {
			const req = config?.transformRequest ? await config.transformRequest(request) : request;
			const res = await handler(req);
			if (config?.transformResponse) {
				return await config.transformResponse(res);
			}
			return res;
		},
		endpoints,
	};
};

export type Router = ReturnType<typeof createRouter>;
