import type { EndpointOptions } from "./endpoint";
import { _statusCode, APIError, type Status } from "./error";
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
import {
	getCookieKey,
	parseCookies,
	serializeCookie,
	serializeSignedCookie,
	type CookieOptions,
	type CookiePrefixOptions,
} from "./cookies";
import { getCryptoKey, verifySignature } from "./crypto";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type Method = HTTPMethod | "*";

export type InferBodyInput<Options extends EndpointOptions | MiddlewareOptions> =
	Options["metadata"] extends {
		$Infer: {
			body: infer Body;
		};
	}
		? Body
		: Options["body"] extends StandardSchemaV1
			? StandardSchemaV1.InferInput<Options["body"]>
			: any;

export type InferBody<Options extends EndpointOptions | MiddlewareOptions> =
	Options["metadata"] extends {
		$Infer: {
			body: infer Body;
		};
	}
		? Body
		: Options["body"] extends StandardSchemaV1
			? StandardSchemaV1.InferOutput<Options["body"]>
			: any;

export type InferQueryInput<Options extends EndpointOptions | MiddlewareOptions> =
	Options["metadata"] extends {
		$Infer: {
			query: infer Query;
		};
	}
		? Query
		: Options["query"] extends StandardSchemaV1
			? StandardSchemaV1.InferInput<Options["query"]>
			: Record<string, any> | undefined;

export type InferQuery<Options extends EndpointOptions | MiddlewareOptions> =
	Options["metadata"] extends {
		$Infer: {
			query: infer Query;
		};
	}
		? Query
		: Options["query"] extends StandardSchemaV1
			? StandardSchemaV1.InferOutput<Options["query"]>
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
	? Record<string, any> | undefined
	: Prettify<InferParamPath<Path> & InferParamWildCard<Path>>;

export type InferRequest<Option extends EndpointOptions | MiddlewareOptions> =
	Option["requireRequest"] extends true ? Request : Request | undefined;

export type InferHeaders<Option extends EndpointOptions | MiddlewareOptions> =
	Option["requireHeaders"] extends true ? Headers : Headers | undefined;

export type InferHeadersInput<Option extends EndpointOptions | MiddlewareOptions> =
	Option["requireHeaders"] extends true ? HeadersInit : HeadersInit | undefined;

export type InferUse<Opts extends EndpointOptions["use"]> = Opts extends Middleware[]
	? UnionToIntersection<Awaited<ReturnType<Opts[number]>>>
	: {};

export type InferMiddlewareBody<Options extends MiddlewareOptions> =
	Options["body"] extends StandardSchemaV1<infer T> ? T : any;

export type InferMiddlewareQuery<Options extends MiddlewareOptions> =
	Options["query"] extends StandardSchemaV1<infer T> ? T : Record<string, any> | undefined;

export type InputContext<Path extends string, Options extends EndpointOptions> = Input<{
	/**
	 * Payload
	 */
	body: InferBodyInput<Options>;
	/**
	 * Request Method
	 */
	method: InferInputMethod<Options>;
	/**
	 * Query Params
	 */
	query: InferQueryInput<Options>;
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
	headers: InferHeadersInput<Options>;
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
	/**
	 * Customize the path
	 */
	path?: string;
}>;

export const createInternalContext = async (
	context: InputContext<any, any>,
	{
		options,
		path,
	}: {
		options: EndpointOptions;
		path: string;
	},
) => {
	const headers = new Headers();
	const { data, error } = await runValidation(options, context);
	if (error) {
		throw new APIError(400, {
			message: error.message,
		});
	}
	const requestHeaders: Headers | null =
		"headers" in context
			? context.headers instanceof Headers
				? context.headers
				: new Headers(context.headers)
			: "request" in context && context.request instanceof Request
				? context.request.headers
				: null;
	const requestCookies = requestHeaders?.get("cookie");
	const parsedCookies = requestCookies ? parseCookies(requestCookies) : undefined;
	const internalContext = {
		...context,
		body: data.body,
		query: data.query,
		path: context.path || path,
		context: undefined as any,
		returned: undefined as any,
		headers: context?.headers,
		request: context?.request,
		params: "params" in context ? context.params : undefined,
		method: context.method,
		setHeader: (key: string, value: string) => {
			headers.set(key, value);
		},
		getHeader: (key: string) => {
			if (!requestHeaders) return null;
			return requestHeaders.get(key);
		},
		getCookie: (key: string, prefix?: CookiePrefixOptions) => {
			const finalKey = getCookieKey(key, prefix);
			if (!finalKey) {
				return null;
			}
			return parsedCookies?.get(finalKey) || null;
		},
		getSignedCookie: async (key: string, secret: string, prefix?: CookiePrefixOptions) => {
			const finalKey = getCookieKey(key, prefix);
			if (!finalKey) {
				return null;
			}
			const value = parsedCookies?.get(finalKey);
			if (!value) {
				return null;
			}
			const signatureStartPos = value.lastIndexOf(".");
			if (signatureStartPos < 1) {
				return null;
			}
			const signedValue = value.substring(0, signatureStartPos);
			const signature = value.substring(signatureStartPos + 1);
			if (signature.length !== 44 || !signature.endsWith("=")) {
				return null;
			}
			const secretKey = await getCryptoKey(secret);
			const isVerified = await verifySignature(signature, signedValue, secretKey);
			return isVerified ? signedValue : false;
		},
		setCookie: (key: string, value: string, options?: CookieOptions) => {
			const cookie = serializeCookie(key, value, options);
			headers.append("set-cookie", cookie);
			return cookie;
		},
		setSignedCookie: async (
			key: string,
			value: string,
			secret: string,
			options?: CookieOptions,
		) => {
			const cookie = await serializeSignedCookie(key, value, secret, options);
			headers.append("set-cookie", cookie);
			return cookie;
		},
		redirect: (url: string) => {
			headers.set("location", url);
			return new APIError("FOUND", undefined, headers);
		},
		error: (
			status: keyof typeof _statusCode | Status,
			body?:
				| {
						message?: string;
						code?: string;
				  }
				| undefined,
			headers?: HeadersInit,
		) => {
			return new APIError(status, body, headers);
		},
		json: (
			json: Record<string, any>,
			routerResponse?:
				| {
						status?: number;
						headers?: Record<string, string>;
						response?: Response;
						body?: Record<string, string>;
				  }
				| Response,
		) => {
			if (!context.asResponse) {
				return json;
			}
			return {
				body: routerResponse?.body || json,
				routerResponse,
				_flag: "json",
			};
		},
		responseHeaders: headers,
	};
	//if context was shimmed through the input we want to apply it
	const middlewareContext = {
		...("context" in context && context.context ? context.context : {}),
	};
	for (const middleware of options.use || []) {
		const response = await middleware(internalContext);
		Object.assign(middlewareContext, response);
	}
	internalContext.context = middlewareContext;
	return internalContext;
};
