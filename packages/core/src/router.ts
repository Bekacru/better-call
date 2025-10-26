import { addRoute, createRouter as createRou3Router, findAllRoutes, findRoute } from "rou3";
import { type Endpoint, createEndpoint } from "./endpoint";
import type { Middleware } from "./middleware";
import { generator, getHTML } from "./openapi";
import { toResponse } from "./to-response";
import { getBody, isAPIError } from "./utils";

export interface RouterConfig {
	throwError?: boolean;
	onError?: (e: unknown) => void | Promise<void> | Response | Promise<Response>;
	basePath?: string;
	routerMiddleware?: Array<{
		path: string;
		middleware: Middleware;
	}>;
	/**
	 * additional Context that needs to passed to endpoints
	 *
	 * this will be available on `ctx.context` on endpoints
	 */
	routerContext?: Record<string, any>;
	/**
	 * A callback to run before any response
	 */
	onResponse?: (res: Response) => any | Promise<any>;
	/**
	 * A callback to run before any request
	 */
	onRequest?: (req: Request) => any | Promise<any>;
	/**
	 * Open API route configuration
	 */
	openapi?: {
		/**
		 * Disable openapi route
		 *
		 * @default false
		 */
		disabled?: boolean;
		/**
		 * A path to display open api using scalar
		 *
		 * @default "/api/reference"
		 */
		path?: string;
		/**
		 * Scalar Configuration
		 */
		scalar?: {
			/**
			 * Title
			 * @default "Open API Reference"
			 */
			title?: string;
			/**
			 * Description
			 *
			 * @default "Better Call Open API Reference"
			 */
			description?: string;
			/**
			 * Logo URL
			 */
			logo?: string;
			/**
			 * Scalar theme
			 * @default "saturn"
			 */
			theme?: string;
		};
	};
}

export const createRouter = <E extends Record<string, Endpoint>, Config extends RouterConfig>(
	endpoints: E,
	config?: Config,
) => {
	if (!config?.openapi?.disabled) {
		const openapi = {
			path: "/api/reference",
			...config?.openapi,
		};
		//@ts-expect-error
		endpoints["openapi"] = createEndpoint(
			openapi.path,
			{
				method: "GET",
			},
			async (c) => {
				const schema = await generator(endpoints);
				return new Response(getHTML(schema, openapi.scalar), {
					headers: {
						"Content-Type": "text/html",
					},
				});
			},
		);
	}
	const router = createRou3Router();
	const middlewareRouter = createRou3Router();

	for (const endpoint of Object.values(endpoints)) {
		if (!endpoint.options) {
			continue;
		}
		if (endpoint.options?.metadata?.SERVER_ONLY) continue;

		const methods = Array.isArray(endpoint.options?.method)
			? endpoint.options.method
			: [endpoint.options?.method];

		for (const method of methods) {
			addRoute(router, method, endpoint.path, endpoint);
		}
	}

	if (config?.routerMiddleware?.length) {
		for (const { path, middleware } of config.routerMiddleware) {
			addRoute(middlewareRouter, "*", path, middleware);
		}
	}

	const processRequest = async (request: Request) => {
		const url = new URL(request.url);
		const path = config?.basePath
			? url.pathname
					.split(config.basePath)
					.reduce((acc, curr, index) => {
						if (index !== 0) {
							if (index > 1) {
								acc.push(`${config.basePath}${curr}`);
							} else {
								acc.push(curr);
							}
						}
						return acc;
					}, [] as string[])
					.join("")
			: url.pathname;

		if (!path?.length) {
			return new Response(null, { status: 404, statusText: "Not Found" });
		}

		const route = findRoute(router, request.method, path);
		if (!route?.data) {
			return new Response(null, { status: 404, statusText: "Not Found" });
		}

		const query: Record<string, string | string[]> = {};
		url.searchParams.forEach((value, key) => {
			if (key in query) {
				if (Array.isArray(query[key])) {
					(query[key] as string[]).push(value);
				} else {
					query[key] = [query[key] as string, value];
				}
			} else {
				query[key] = value;
			}
		});

		const handler = route.data as Endpoint;
		const context = {
			path,
			method: request.method as "GET",
			headers: request.headers,
			params: route.params ? (JSON.parse(JSON.stringify(route.params)) as any) : {},
			request: request,
			body: handler.options.disableBody
				? undefined
				: await getBody(handler.options.cloneRequest ? request.clone() : request),
			query,
			_flag: "router" as const,
			asResponse: true,
			context: config?.routerContext,
		};

		try {
			const middlewareRoutes = findAllRoutes(middlewareRouter, "*", path);
			if (middlewareRoutes?.length) {
				for (const { data: middleware, params } of middlewareRoutes) {
					const res = await (middleware as Endpoint)({
						...context,
						params,
						asResponse: false,
					});

					if (res instanceof Response) return res;
				}
			}

			const response = (await handler(context)) as Response;
			return response;
		} catch (error) {
			if (config?.onError) {
				try {
					const errorResponse = await config.onError(error);

					if (errorResponse instanceof Response) {
						return toResponse(errorResponse);
					}
				} catch (error) {
					if (isAPIError(error)) {
						return toResponse(error);
					}

					throw error;
				}
			}

			if (config?.throwError) {
				throw error;
			}

			if (isAPIError(error)) {
				return toResponse(error);
			}

			console.error(`# SERVER_ERROR: `, error);
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
			const res = await processRequest(req);
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
