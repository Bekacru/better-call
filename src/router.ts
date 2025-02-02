import { createRouter as createRou3Router, addRoute, findRoute, findAllRoutes } from "rou3";
import { getBody, shouldSerialize, statusCode } from "./utils";
import { APIError } from "./error";
import type { Endpoint } from "./types";

export interface RouterConfig {
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
	onResponse?: (res: Response) => any | Promise<any>;
	onRequest?: (req: Request) => any | Promise<any>;
	/**
	 * Disable request cloning
	 *
	 * @default false
	 */
	disableRequestCloning?: boolean;
}

export const createRouter = <E extends Record<string, Endpoint>, Config extends RouterConfig>(
	endpoints: E,
	config?: Config,
) => {
	const _endpoints = Object.values(endpoints);
	const router = createRou3Router();
	for (const endpoint of _endpoints) {
		if (endpoint.options.metadata?.SERVER_ONLY) continue;
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
				`[better-call]: Make sure the URL has the basePath (${config?.basePath}).`,
			);
			return new Response(null, {
				status: 404,
				statusText: "Not Found",
			});
		}
		const method = request.method;
		const route = findRoute(router, method, path);
		const handler = route?.data as Endpoint;
		const body = await getBody(config?.disableRequestCloning ? request : request.clone());
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
					headers: e.headers,
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
			const onReq = await config?.onRequest?.(request);
			if (onReq instanceof Response) {
				return onReq;
			}
			const req = onReq instanceof Request ? onReq : request;
			const res = await handler(req);
			const onRes = await config?.onResponse?.(res);
			if (onRes instanceof Response) {
				return onRes;
			}
			return res;
		},
		endpoints,
	};
};

export type Router = ReturnType<typeof createRouter>;
