"use server";
import { ZodError } from "zod";
import { APIError } from "./error";
import { json, type HasRequiredKeys } from "./helper";
import type {
	Context,
	ContextTools,
	Endpoint,
	EndpointOptions,
	EndpointResponse,
	Handler,
	InferUse,
	Prettify,
} from "./types";
import { getCookie, getSignedCookie, setCookie, setSignedCookie } from "./cookie-utils";
import type { CookiePrefixOptions, CookieOptions } from "./cookie";

export interface EndpointConfig {
	/**
	 * Throw when the response isn't in 200 range
	 */
	throwOnError?: boolean;
}

export function createEndpointCreator<
	E extends {
		use?: Endpoint[];
	},
>(opts?: E) {
	return <Path extends string, Opts extends EndpointOptions, R extends EndpointResponse>(
		path: Path,
		options: Opts,
		handler: (
			ctx: Prettify<
				Context<Path, Opts> &
					InferUse<Opts["use"]> &
					InferUse<E["use"]> &
					Omit<ContextTools, "_flag">
			>,
		) => Promise<R>,
	) => {
		return createEndpoint(
			path,
			{
				...options,
				use: [...(options?.use || []), ...(opts?.use || [])],
			},
			handler,
		);
	};
}

export function createEndpoint<
	Path extends string,
	Opts extends EndpointOptions,
	R extends EndpointResponse,
>(path: Path, options: Opts, handler: Handler<Path, Opts, R>) {
	let responseHeader = new Headers();
	type Ctx = Context<Path, Opts>;
	const handle = async <C extends HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]>(
		...ctx: C
	) => {
		let internalCtx = {
			setHeader(key: string, value: string) {
				responseHeader.set(key, value);
			},
			setCookie(key: string, value: string, options?: CookieOptions) {
				setCookie(responseHeader, key, value, options);
			},
			getCookie(key: string, prefix?: CookiePrefixOptions) {
				const header = ctx[0]?.headers;
				const cookieH = header?.get("cookie");
				const cookie = getCookie(cookieH || "", key, prefix);
				return cookie;
			},
			getSignedCookie(key: string, secret: string, prefix?: CookiePrefixOptions) {
				const header = ctx[0]?.headers;
				if (!header) {
					throw new TypeError("Headers are required");
				}
				const cookie = getSignedCookie(header, secret, key, prefix);
				return cookie;
			},
			async setSignedCookie(
				key: string,
				value: string,
				secret: string | BufferSource,
				options?: CookieOptions,
			) {
				await setSignedCookie(responseHeader, key, value, secret, options);
			},
			redirect(url: string) {
				responseHeader.set("Location", url);
				return new APIError("FOUND");
			},
			json,
			context: (ctx[0] as any)?.context || {},
			_flag: (ctx[0] as any)?.asResponse ? "router" : (ctx[0] as any)?._flag,
			responseHeader,
			path: path,
			...(ctx[0] || {}),
		};
		if (options.use?.length) {
			let middlewareContexts = {};
			let middlewareBody = {};
			for (const middleware of options.use) {
				if (typeof middleware !== "function") {
					console.warn("Middleware is not a function", {
						middleware,
					});
					continue;
				}
				const res = (await middleware(internalCtx)) as Endpoint;
				if (res) {
					const body = res.options?.body
						? res.options.body.parse(internalCtx.body)
						: undefined;
					middlewareContexts = {
						...middlewareContexts,
						...res,
					};
					middlewareBody = {
						...middlewareBody,
						...body,
					};
				}
			}
			internalCtx = {
				...internalCtx,
				body: {
					...middlewareBody,
					...(internalCtx.body as Record<string, any>),
				},
				context: {
					...(internalCtx.context || {}),
					...middlewareContexts,
				},
			};
		}
		try {
			const body = options.body ? options.body.parse(internalCtx.body) : internalCtx.body;
			internalCtx = {
				...internalCtx,
				body: body
					? {
							...body,
							...(internalCtx.body as Record<string, any>),
						}
					: internalCtx.body,
			};
			internalCtx.query = options.query
				? options.query.parse(internalCtx.query)
				: internalCtx.query;
		} catch (e) {
			if (e instanceof ZodError) {
				throw new APIError("BAD_REQUEST", {
					message: e.message,
					details: e.errors,
				});
			}
			throw e;
		}
		if (options.requireHeaders && !internalCtx.headers) {
			throw new APIError("BAD_REQUEST", {
				message: "Headers are required",
			});
		}
		if (options.requireRequest && !internalCtx.request) {
			throw new APIError("BAD_REQUEST", {
				message: "Request is required",
			});
		}
		// If request is provided but headers are not provided
		// then set headers from request
		if (internalCtx.request && !internalCtx.headers) {
			internalCtx.headers = internalCtx.request.headers;
		}
		try {
			let res = (await handler(internalCtx as any)) as any;
			let actualResponse: any = res;

			if (res && typeof res === "object" && "_flag" in res) {
				if (res._flag === "json" && internalCtx._flag === "router") {
					const h = res.response.headers as Record<string, string>;
					Object.keys(h || {}).forEach((key) => {
						responseHeader.set(key, h[key as keyof typeof h]);
					});
					responseHeader.set("Content-Type", "application/json");
					actualResponse = new Response(JSON.stringify(res.response.body), {
						status: res.response.status ?? 200,
						statusText: res.response.statusText,
						headers: responseHeader,
					});
				} else {
					actualResponse = res.body;
				}
			}

			responseHeader = new Headers();

			type ReturnT = Awaited<ReturnType<Handler<Path, Opts, R>>>;
			return actualResponse as C extends [{ asResponse: true }]
				? Response
				: R extends {
							_flag: "json";
						}
					? R extends { body: infer B }
						? B
						: null
					: ReturnT;
		} catch (e) {
			if (e instanceof APIError) {
				responseHeader.set("Content-Type", "application/json");
				e.headers = responseHeader;
				responseHeader = new Headers();
				throw e;
			}
			throw e;
		}
	};
	handle.path = path;
	handle.options = options;
	handle.method = options.method;
	handle.headers = responseHeader;
	return handle;
}
