import { ZodObject, ZodOptional, type ZodSchema } from "zod";
import type { HasRequiredKeys } from "./helper";
import { toResponse } from "./to-response";
import type { Middleware } from "./middleware";
import {
	createInternalContext,
	type InferBody,
	type InferHeaders,
	type InferMethod,
	type InferParam,
	type InferQuery,
	type InferRequest,
	type InferUse,
	type InputContext,
	type Method,
} from "./context";
import type { CookieOptions, CookiePrefixOptions } from "./cookies";
import type { APIError } from "./error";

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
	query?: ZodObject<any> | ZodOptional<ZodObject<any>>;
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
	metadata?: {
		/**
		 * Open API definition
		 */
		openAPI?: {};
		/**
		 * Infer body and query type from ts interface
		 *
		 * useful for generic and dynamic types
		 *
		 * @example
		 * ```ts
		 * const endpoint = createEndpoint("/path", {
		 * 		method: "POST",
		 * 		body: z.record(z.string()),
		 * 		$Infer: {
		 * 			body: {} as {
		 * 				type: InferTypeFromOptions<Option> // custom type inference
		 * 			}
		 * 		}
		 * 	}, async(ctx)=>{
		 * 		const body = ctx.body
		 * 	})
		 * ```
		 */
		$Infer?: {
			/**
			 * Body
			 */
			body?: any;
			/**
			 * Query
			 */
			query?: Record<string, any>;
		};
	};
	/**
	 * List of middlewares to use
	 */
	use?: Middleware[];
}

export type EndpointContext<Path extends string, Options extends EndpointOptions> = {
	/**
	 * Method
	 *
	 * The request method
	 */
	method: InferMethod<Options>;
	/**
	 * Path
	 *
	 * The path of the endpoint
	 */
	path: Path;
	/**
	 * Body
	 *
	 * The body object will be the parsed JSON from the request and validated
	 * against the body schema if it exists.
	 */
	body: InferBody<Options>;
	/**
	 * Query
	 *
	 * The query object will be the parsed query string from the request
	 * and validated against the query schema if it exists
	 */
	query: InferQuery<Options>;
	/**
	 * Params
	 *
	 * If the path is `/user/:id` and the request is `/user/1` then the params will
	 * be `{ id: "1" }` and if the path includes a wildcard like `/user/*` then the
	 * params will be `{ _: "1" }` where `_` is the wildcard key. If the wildcard
	 * is named like `/user/**:name` then the params will be `{ name: string }`
	 */
	params: InferParam<Path>;
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
	 * Get a cookie value from the request
	 *
	 * @param key - The key of the cookie
	 * @param prefix - The prefix of the cookie between `__Secure-` and `__Host-`
	 * @returns - The value of the cookie
	 */
	getCookie: (key: string, prefix?: CookiePrefixOptions) => string | null;
	/**
	 * Get a signed cookie value from the request
	 *
	 * @param key - The key of the cookie
	 * @param secret - The secret of the signed cookie
	 * @param prefix - The prefix of the cookie between `__Secure-` and `__Host-`
	 * @returns
	 */
	getSignedCookie: (
		key: string,
		secret: string,
		prefix?: CookiePrefixOptions,
	) => Promise<string | null>;
	/**
	 * Set a cookie value in the response
	 *
	 * @param key - The key of the cookie
	 * @param value - The value to set
	 * @param options - The options of the cookie
	 * @returns - The cookie string
	 */
	setCookie: (key: string, value: string, options?: CookieOptions) => string;
	/**
	 * Set signed cookie
	 *
	 * @param key - The key of the cookie
	 * @param value  - The value to set
	 * @param secret - The secret to sign the cookie with
	 * @param options - The options of the cookie
	 * @returns - The cookie string
	 */
	setSignedCookie: (
		key: string,
		value: string,
		secret: string,
		options?: CookieOptions,
	) => Promise<string>;
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
	/**
	 * Middleware context
	 */
	context: InferUse<Options["use"]>;
	/**
	 * Redirect to a new URL
	 */
	redirect: (url: string) => APIError;
};

export const createEndpoint = <Path extends string, Options extends EndpointOptions, R>(
	path: Path,
	options: Options,
	handler: (context: EndpointContext<Path, Options>) => Promise<R>,
) => {
	const internalHandler = async <Context extends InputContext<Path, Options>>(
		...inputCtx: HasRequiredKeys<Context> extends true ? [Context] : [Context?]
	) => {
		const context = (inputCtx[0] || {}) as InputContext<any, any>;
		const headers: HeadersInit = {};
		const internalContext = createInternalContext(context, {
			options,
			path,
			headers,
		});
		const middlewareContext = {};
		for (const middleware of options.use || []) {
			const response = await middleware(internalContext);
			Object.assign(middlewareContext, response);
		}
		internalContext.context = middlewareContext;
		const response = await handler(internalContext as any);
		return (
			context.asResponse
				? toResponse(response, {
						headers,
					})
				: context.returnHeaders
					? {
							headers: new Headers(headers),
							response,
						}
					: response
		) as Context["asResponse"] extends true
			? Response
			: Context["returnHeaders"] extends true
				? {
						headers: Headers;
						response: R;
					}
				: R;
	};
	return internalHandler;
};
