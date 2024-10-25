import type { Endpoint, Prettify } from "./types";

import { type BetterFetchOption, type BetterFetchResponse, createFetch } from "@better-fetch/fetch";
import type { Router } from "./router";
import type { HasRequiredKeys, UnionToIntersection } from "./helper";

type HasRequired<
	T extends {
		body?: any;
		query?: any;
		params?: any;
	},
> = HasRequiredKeys<T> extends true
	? HasRequiredKeys<T["body"]> extends false
		? HasRequiredKeys<T["query"]> extends false
			? HasRequiredKeys<T["params"]> extends false
				? false
				: true
			: true
		: true
	: true;

type InferContext<T> = T extends (ctx: infer Ctx) => any
	? Ctx extends object
		? Ctx
		: never
	: never;

export interface ClientOptions extends BetterFetchOption {
	baseURL: string;
}

type WithRequired<T, K> = T & {
	[P in K extends string ? K : never]-?: T[P extends keyof T ? P : never];
};

export type RequiredOptionKeys<
	C extends {
		body?: any;
		query?: any;
		params?: any;
	},
> = (undefined extends C["body"]
	? {}
	: {
			body: true;
		}) &
	(undefined extends C["query"]
		? {}
		: {
				query: true;
			}) &
	(undefined extends C["params"]
		? {}
		: {
				params: true;
			});

export const createClient = <R extends Router | Router["endpoints"]>(options: ClientOptions) => {
	const fetch = createFetch(options);
	type API = R extends { endpoints: Record<string, Endpoint> } ? R["endpoints"] : R;
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
	return async <OPT extends O, K extends keyof OPT, C extends InferContext<OPT[K]>>(
		path: K,
		...options: HasRequired<C> extends true
			? [
					WithRequired<
						BetterFetchOption<C["body"], C["query"], C["params"]>,
						keyof RequiredOptionKeys<C>
					>,
				]
			: [BetterFetchOption<C["body"], C["query"], C["params"]>?]
	): Promise<
		BetterFetchResponse<Awaited<ReturnType<OPT[K] extends Endpoint ? OPT[K] : never>>>
	> => {
		return (await fetch(path as string, {
			...options[0],
		})) as any;
	};
};
