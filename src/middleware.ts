import { z } from "zod";
import type {
	ContextTools,
	Endpoint,
	EndpointOptions,
	EndpointResponse,
	Handler,
	InferBody,
	InferHeaders,
	InferRequest,
	InferUse,
	Prettify,
} from "./types";
import { createEndpoint } from "./endpoint";

export type MiddlewareHandler<
	Opts extends EndpointOptions,
	R extends EndpointResponse,
	Extra extends Record<string, any> = {},
> = (
	ctx: Prettify<
		InferBody<Opts> &
			InferRequest<Opts> &
			InferHeaders<Opts> & {
				params?: Record<string, string>;
				query?: Record<string, string>;
			} & ContextTools
	> &
		Extra,
) => Promise<R>;

export function createMiddleware<Opts extends EndpointOptions, R extends EndpointResponse>(
	optionsOrHandler: MiddlewareHandler<Opts, R>,
): Endpoint<Handler<string, Opts, R>, Opts>;
export function createMiddleware<
	Opts extends Omit<EndpointOptions, "method">,
	R extends EndpointResponse,
>(
	optionsOrHandler: Opts,
	handler: MiddlewareHandler<
		Opts & {
			method: "*";
		},
		R
	>,
): Endpoint<
	Handler<
		string,
		Opts & {
			method: "*";
		},
		R
	>,
	Opts & {
		method: "*";
	}
>;
export function createMiddleware(optionsOrHandler: any, handler?: any) {
	if (typeof optionsOrHandler === "function") {
		return createEndpoint(
			"*",
			{
				method: "*",
			},
			optionsOrHandler,
		);
	}
	if (!handler) {
		throw new Error("Middleware handler is required");
	}
	const endpoint = createEndpoint(
		"*",
		{
			...optionsOrHandler,
			method: "*",
		},
		handler,
	);
	return endpoint as any;
}

export const createMiddlewareCreator = <
	E extends {
		use?: Endpoint[];
	},
>(
	opts?: E,
) => {
	type H<Opts extends EndpointOptions, R extends EndpointResponse> = (
		ctx: Prettify<
			InferBody<Opts> &
				InferUse<E["use"]> &
				InferRequest<Opts> &
				InferHeaders<Opts> & {
					params?: Record<string, string>;
					query?: Record<string, string>;
				} & ContextTools
		>,
	) => Promise<R>;
	function fn<Opts extends EndpointOptions, R extends EndpointResponse>(
		optionsOrHandler: H<Opts, R>,
	): Endpoint<Handler<string, Opts, R>, Opts>;
	function fn<Opts extends Omit<EndpointOptions, "method">, R extends EndpointResponse>(
		optionsOrHandler: Opts,
		handler: H<
			Opts & {
				method: "*";
			},
			R
		>,
	): Endpoint<
		Handler<
			string,
			Opts & {
				method: "*";
			},
			R
		>,
		Opts & {
			method: "*";
		}
	>;
	function fn(optionsOrHandler: any, handler?: any) {
		if (typeof optionsOrHandler === "function") {
			return createEndpoint(
				"*",
				{
					method: "*",
				},
				optionsOrHandler,
			);
		}
		if (!handler) {
			throw new Error("Middleware handler is required");
		}
		const endpoint = createEndpoint(
			"*",
			{
				...optionsOrHandler,
				method: "*",
			},
			handler,
		);
		return endpoint as any;
	}
	return fn;
};

export type Middleware<
	Opts extends EndpointOptions = EndpointOptions,
	R extends EndpointResponse = EndpointResponse,
> = (
	opts: Opts,
	handler: (ctx: {
		body?: InferBody<Opts>;
		params?: Record<string, string>;
		query?: Record<string, string>;
	}) => Promise<R>,
) => Endpoint;
