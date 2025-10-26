import type { Endpoint, HasRequiredKeys } from "@better-call/core";

export type NoKey = null | undefined | void | false;
export type SomeKey = string | number | true;
export type Key = string;
export type KeyParts = SomeKey[];

export type Fn<P extends any[] = [], R = void> = (...args: P) => R;

export type HasRequired<
	T extends {
		body?: any;
		query?: any;
		params?: any;
	},
> = T["body"] extends object
	? HasRequiredKeys<T["body"]> extends true
		? true
		: T["query"] extends object
			? HasRequiredKeys<T["query"]> extends true
				? true
				: T["params"] extends object
					? HasRequiredKeys<T["params"]>
					: false
			: T["params"] extends object
				? HasRequiredKeys<T["params"]>
				: false
	: T["query"] extends object
		? HasRequiredKeys<T["query"]> extends true
			? true
			: T["params"] extends object
				? HasRequiredKeys<T["params"]>
				: false
		: T["params"] extends object
			? HasRequiredKeys<T["params"]>
			: false;

export type InferContext<T> = T extends (ctx: infer Ctx) => any
	? Ctx extends object
		? Ctx
		: never
	: never;

export type WithRequired<T, K> = T & {
	[P in K extends string ? K : never]-?: T[P extends keyof T ? P : never];
};

export type WithoutServerOnly<T extends Record<string, Endpoint>> = {
	[K in keyof T]: T[K] extends Endpoint<any, infer O>
		? O extends { metadata: { SERVER_ONLY: true } }
			? never
			: T[K]
		: T[K];
};
