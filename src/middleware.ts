import type { ZodSchema } from "zod";
import {
	createInternalContext,
	type EndpointOptions,
	type InferHeaders,
	type InferRequest,
	type InputContext,
} from "./endpoint";

export interface MiddlewareOptions extends Omit<EndpointOptions, "method"> {
	/**
	 * The order a middleware runs
	 *
	 * - pre: before the endpoint runs
	 * - post: after the endpoint runs and `returned` would be defined
	 * in this case
	 */
	order?: "pre" | "post";
}

export type InferMiddlewareBody<Options extends MiddlewareOptions> =
	Options["body"] extends ZodSchema<infer T> ? T : any;

export type InferMiddlewareQuery<Options extends MiddlewareOptions> =
	Options["query"] extends ZodSchema<infer T> ? T : any;

export type MiddlewareContext<Options extends MiddlewareOptions> = {
	/**
	 * Method
	 *
	 * The request method
	 */
	method: string;
	/**
	 * Path
	 *
	 * The path of the endpoint
	 */
	path: string;
	/**
	 * Body
	 *
	 * The body object will be the parsed JSON from the request and validated
	 * against the body schema if it exists
	 */
	body: InferMiddlewareBody<Options>;
	/**
	 * Query
	 *
	 * The query object will be the parsed query string from the request
	 * and validated against the query schema if it exists
	 */
	query: InferMiddlewareQuery<Options>;
	/**
	 * Params
	 *
	 * If the path is `/user/:id` and the request is `/user/1` then the
	 * params will
	 * be `{ id: "1" }` and if the path includes a wildcard like `/user/*`
	 * then the
	 * params will be `{ _: "1" }` where `_` is the wildcard key. If the
	 * wildcard
	 * is named like `/user/**:name` then the params will be `{ name: string }`
	 */
	params: string;
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
	 * JSON
	 *
	 * a helper function to create a JSON response with
	 * the correct headers
	 * and status code. If `asResponse` is set to true in
	 * the context then
	 * it will return a Response object instead of the
	 * JSON object.
	 *
	 * @param json - The JSON object to return
	 * @param routerResponse - The response object to
	 * return if `asResponse` is
	 * true in the context this will take precedence
	 */
	json: <R extends Record<string, any> | null>(
		json: R,
		routerResponse?:
			| {
					status?: number;
					headers?: Record<string, string>;
					response?: Response;
			  }
			| Response,
	) => Promise<R>;
	returned: Options["order"] extends "post" ? any : never;
};

export function createMiddleware<
	Options extends Omit<MiddlewareOptions, "method">,
	R,
	Handler extends (
		context: MiddlewareContext<
			Options & {
				method: "*";
			}
		>,
	) => Promise<R>,
>(
	options: Options,
	handler: (
		context: MiddlewareContext<
			Options & {
				method: "*";
			}
		>,
	) => Promise<R>,
): Middleware<
	Options & {
		method: "*";
	},
	Handler
>;
export function createMiddleware<
	Options extends Omit<MiddlewareOptions, "method">,
	R,
	Handler extends (
		context: MiddlewareContext<
			Options & {
				method: "*";
			}
		>,
	) => Promise<R>,
>(
	handler: Handler,
): Middleware<
	Options & {
		method: "*";
	},
	Handler
>;
export function createMiddleware(optionsOrHandler: any, handler?: any) {
	const internalHandler = async (inputCtx: InputContext<any, any>) => {
		const context = inputCtx as InputContext<any, any>;
		const headers: HeadersInit = {};
		const _handler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler;
		const internalContext = createInternalContext(context, {
			options: {
				method: "*",
			},
			path: "/",
			headers,
		});
		const response = await _handler(internalContext as any);
		return response;
	};
	internalHandler.options =
		typeof optionsOrHandler === "function"
			? {
					order: "pre",
				}
			: optionsOrHandler;
	return internalHandler;
}

export type Middleware<
	Options extends EndpointOptions = EndpointOptions,
	Handler extends (inputCtx: any) => Promise<any> = any,
> = Handler & {
	options: Options;
};
