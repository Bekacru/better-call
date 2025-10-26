// TODO:

import type { Method, Router } from "@better-call/core";

export type CamelCase<S extends string> =
	S extends `${infer P1}-${infer P2}${infer P3}`
		? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
		: Lowercase<S>;

export type PathToObject<
	T extends string,
	M extends Method,
	Fn extends (...args: any[]) => any,
> = T extends `/${infer Segment}/${infer Rest}`
	? { [K in CamelCase<Segment>]: PathToObject<`/${Rest}`, M, Fn> }
	: T extends `/${infer Segment}`
		? {
				[K in CamelCase<Segment> as `${K}${Lowercase<M extends "GET" | "*" ? "" : `$${M}`>}`]: Fn;
			}
		: never;

type FirstMethod<M extends Method | Method[]> = M extends [infer _M, ...any[]]
	? _M
	: M extends (infer U)[]
		? U
		: M;

export type WithProxyOptions = {
	unsafe_noSuffix?: boolean;
};

export const withProxy = <
	R extends {
		$InferEndpoints: Router["endpoints"];
	} & Record<string, any>,
	O extends WithProxyOptions,
>(
	client: R,
	options?: O,
) => {
	type Endpoints = R["$InferEndpoints"];

	const proxy = {};

	return proxy as {
		[K in keyof Endpoints]: PathToObject<
			Endpoints[K]["path"],
			O["unsafe_noSuffix"] extends true
				? "*"
				: Endpoints[K]["options"]["method"] extends infer M extends
							| Method
							| Method[]
					? FirstMethod<M>
					: "*",
			Endpoints[K]
		>;
	};
};
