import { createRouter as createRou3Router, addRoute, findRoute, findAllRoutes } from "rou3";
import { createEndpoint, type Endpoint } from "./endpoint";
import { generator, getHTML } from "./openapi";
import type { Middleware } from "./middleware";

export interface RouterConfig {
	throwError?: boolean;
	onError?: (e: unknown) => void | Promise<void> | Response | Promise<Response>;
	basePath?: string;
	routerMiddleware?: Array<{
		path: string;
		middleware: Middleware;
	}>;
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
	openAPI?: {
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
	if (!config?.openAPI?.disabled) {
		const openAPI = {
			path: "/api/reference",
			...config?.openAPI,
		};
		//@ts-expect-error
		endpoints["openAPI"] = createEndpoint(
			openAPI.path,
			{
				method: "GET",
			},
			async (c) => {
				const schema = await generator(endpoints);
				return new Response(getHTML(schema, openAPI.scalar), {
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
		if (endpoint.options.metadata?.SERVER_ONLY) continue;

		const methods = Array.isArray(endpoint.options?.method)
			? endpoint.options.method
			: [endpoint.options.method];

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
		const path = config?.basePath ? url.pathname.split(config.basePath)[1] : url.pathname;

		if (!path?.length) {
			config?.onError?.(new Error("NOT_FOUND"));
			return new Response(null, { status: 404, statusText: "Not Found" });
		}

		const route = findRoute(router, request.method, path);
		if (!route?.data) {
			return new Response(null, { status: 404, statusText: "Not Found" });
		}

		const handler = route.data as Endpoint;
		const context = {
			path,
			method: request.method as "GET",
			headers: request.headers,
			params: route.params as any,
			request,
			body: await request.json().catch(() => undefined),
			query: Object.fromEntries(url.searchParams),
			_flag: "router" as const,
			asResponse: true,
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
			return new Response(null, {
				status: 500,
				statusText: "Internal Server Error",
			});
		}
	};

	return {
		handler: async (request: Request) => {
			const modifiedRequest = config?.onRequest ? await config.onRequest(request) : request;

			const req = modifiedRequest instanceof Request ? modifiedRequest : request;

			const response = await processRequest(req);

			if (config?.onResponse) {
				const modifiedResponse = await config.onResponse(response);
				if (modifiedResponse instanceof Response) {
					return modifiedResponse;
				}
			}

			return response;
		},
		endpoints,
	};
};

export type Router = ReturnType<typeof createRouter>;
