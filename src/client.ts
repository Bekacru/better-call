import type { Endpoint, Prettify } from "./types";
import type { HasRequiredKeys, UnionToIntersection } from "type-fest";
import { type BetterFetchOption, type BetterFetchResponse, createFetch } from "@better-fetch/fetch";
import type { Router } from "./router";

type InferContext<T> = T extends (ctx: infer Ctx) => any
	? Ctx extends
			| {
					body: infer Body;
			  }
			| {
					params: infer Param;
			  }
		? (Body extends undefined
				? {}
				: {
						body: Body;
					}) &
				(Param extends undefined
					? {}
					: {
							params: Param;
						})
		: never
	: never;

export interface ClientOptions extends BetterFetchOption {
	baseURL: string;
}

export const createClient = <R extends Router>(options: ClientOptions) => {
	const fetch = createFetch(options);
	type API = R["endpoints"];
	type Options = API extends {
		[key: string]: infer T;
	}
		? T extends Endpoint
			? {
					[key in T["options"]["method"] extends "GET"
						? T["path"]
						: `@${T["options"]["method"] extends string ? Lowercase<T["options"]["method"]> : never}${T["path"]}`]: T;
				}
			: {}
		: {};

	type O = Prettify<UnionToIntersection<Options>>;
	return async <OPT extends O, K extends keyof OPT>(
		path: K,
		...options: HasRequiredKeys<InferContext<OPT[K]>> extends true
			? [BetterFetchOption<InferContext<OPT[K]>["body"], any, InferContext<OPT[K]>["params"]>]
			: [BetterFetchOption<InferContext<OPT[K]>["body"], InferContext<OPT[K]>["params"]>?]
	): Promise<
		BetterFetchResponse<Awaited<ReturnType<OPT[K] extends Endpoint ? OPT[K] : never>>>
	> => {
		const opts = options[0] as {
			params?: Record<string, any>;
			body?: Record<string, any>;
		};
		return (await fetch(path as string, {
			...options[0],
			body: opts.body,
			params: opts.params,
		})) as any;
	};
};
