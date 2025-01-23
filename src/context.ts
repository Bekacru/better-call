import type { ZodSchema } from "zod";
import type { EndpointOptions } from "./endpoint";
import { APIError } from "./error";
import type {
	InferParamPath,
	InferParamWildCard,
	Input,
	IsEmptyObject,
	Prettify,
	UnionToIntersection,
} from "./helper";
import type { Middleware, MiddlewareOptions } from "./middleware";
import { runValidation } from "./validator";

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type Method = HTTPMethod | "*";

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

export type InferMiddlewareBody<Options extends MiddlewareOptions> =
	Options["body"] extends ZodSchema<infer T> ? T : any;

export type InferMiddlewareQuery<Options extends MiddlewareOptions> =
	Options["query"] extends ZodSchema<infer T> ? T : any;

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
		context: undefined as any,
		returned: undefined as any,
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
