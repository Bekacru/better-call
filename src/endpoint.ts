import { ZodObject, ZodOptional, type ZodSchema } from "zod";
import type {
	HasRequiredKeys,
	InferParamPath,
	InferParamWildCard,
	Input,
	IsEmptyObject,
	Prettify,
	UnionToIntersection,
} from "./helper";
import { runValidation } from "./validator";
import { APIError } from "./error";
import { toResponse } from "./to-response";
import type { Middleware, MiddlewareOptions } from "./middleware";

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type Method = HTTPMethod | "*";

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
	 * Middleware to use
	 */
	use?: any[];
}

export type InferBody<Options extends EndpointOptions> = Options["metadata"] extends {
	$Infer: {
		body: infer Body;
	};
}
	? Body
	: Options["body"] extends ZodSchema<infer T>
		? T
		: never;

export type InferQuery<Options extends EndpointOptions> = Options["metadata"] extends {
	$Infer: {
		query: infer Query;
	};
}
	? Query
	: Options["query"] extends ZodSchema<infer T>
		? T
		: Record<string, any> | undefined;

export type InferMethod<Options extends EndpointOptions> = Options["method"] extends Array<Method>
	? Options["method"][number]
	: Options["method"] extends "*"
		? HTTPMethod
		: Options["method"];

export type InferInputMethod<Options extends EndpointOptions> =
	Options["method"] extends Array<Method>
		? Options["method"][number]
		: Options["method"] extends "*"
			? HTTPMethod
			: Options["method"] | undefined;

export type InferParam<Path extends string> = IsEmptyObject<
	InferParamPath<Path> & InferParamWildCard<Path>
> extends true
	? never
	: Prettify<InferParamPath<Path> & InferParamWildCard<Path>>;

export type InferRequest<Option extends EndpointOptions | MiddlewareOptions> =
	Option["requireRequest"] extends true ? Request : Request | undefined;

export type InferHeaders<Option extends EndpointOptions | MiddlewareOptions> =
	Option["requireHeaders"] extends true
		? Headers | Record<string, any>
		: Headers | undefined | Record<string, any>;

export type InferUse<Opts extends EndpointOptions["use"]> = Opts extends Middleware[]
	? UnionToIntersection<Awaited<ReturnType<Opts[number]>>>
	: {};

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
};

export type InputContext<Path extends string, Options extends EndpointOptions> = Input<{
	/**
	 * Payload
	 */
	body: InferBody<Options>;
	/**
	 * Request Method
	 */
	method: InferInputMethod<Options>;
	/**
	 * Query Params
	 */
	query: InferQuery<Options>;
	/**
	 * Dynamic Params
	 */
	params: InferParam<Path>;
	/**
	 * Request Object
	 */
	request: InferRequest<Options>;
	/**
	 * Headers
	 */
	headers: InferHeaders<Options>;
	/**
	 * Return a `Response` object
	 */
	asResponse?: boolean;
	/**
	 * include headers on the return
	 */
	returnHeaders?: boolean;
	/**
	 * Middlewares to use
	 */
	use?: Middleware[];
}>;

export const createInternalContext = (
	context: InputContext<any, any>,
	{
		options,
		path,
		headers,
	}: {
		options: EndpointOptions;
		path: string;
		headers: HeadersInit;
	},
) => {
	const { data, error } = runValidation(options, context);
	if (error) {
		throw new APIError(400, {
			message: error.message,
		});
	}
	return {
		body: data.body,
		query: data.query,
		path,
		headers: context?.headers,
		request: context?.request,
		params: "params" in context ? context.params : undefined,
		method: context.method,
		setHeader: (key: string, value: string) => {
			headers[key as keyof typeof headers] = value;
		},
		getHeader: (key: string) => {
			const requestHeaders: Headers | null =
				"headers" in context
					? context.headers instanceof Headers
						? context.headers
						: new Headers(context.headers)
					: "request" in context && context.request instanceof Request
						? context.request.headers
						: null;
			if (!requestHeaders) return null;
			return requestHeaders.get(key);
		},
		json: (
			json: Record<string, any>,
			routerResponse?: {
				status?: number;
				headers?: Record<string, string>;
				response?: Response;
			},
		) => {
			if (!context.asResponse) {
				return json;
			}
			return {
				body: json,
				routerResponse,
				_flag: "json",
			};
		},
	};
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
