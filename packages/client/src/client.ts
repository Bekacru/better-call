// TODO: cleanup

/**
 * Inspired by nanostores/query
 *
 * @see {@link https://github.com/nanostores/query}
 */

import {
	BetterFetchError,
	type BetterFetchOption,
	type BetterFetchResponse,
	createFetch,
} from "@better-fetch/fetch";
import type {
	Router,
	Endpoint,
	Prettify,
	UnionToIntersection,
} from "@better-call/core";
import {
	map,
	onStart,
	onStop,
	startTask,
	type Atom,
	type MapStore,
	type ReadableAtom,
	type StoreValue,
} from "nanostores";
import { createEvents } from "./events";
import type {
	Fn,
	HasRequired,
	InferContext,
	Key,
	KeyParts,
	NoKey,
	SomeKey,
	WithoutServerOnly,
	WithRequired,
} from "./types";
import {
	defaultOnErrorRetry,
	getKeyStore,
	getNow,
	testKeyAgainstSelector,
} from "./utils";
import { browserPlatform } from "./browser";

//#region Types

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

export type PlatformCompat = {
	isAppVisible: () => boolean;
	visibilityChangeSubscribe: (cb: () => void) => void;
	reconnectChangeSubscribe: (cb: () => void) => void;
};

export type KeyInput =
	| SomeKey
	| Array<SomeKey | ReadableAtom<SomeKey | NoKey> | QueryStore>;

export type KeySelector = Key | Key[] | ((key: Key) => boolean);

export type CacheEntry = {
	data: null | unknown;
	error: null | BetterFetchError;
	retryAttempt: null | number;
	created: null | number;
	expires: null | number;
};

export type QueryValue<T = any> = {
	data: null | T;
	error: null | BetterFetchError;
	isPending: boolean;
	isRefetching: boolean;

	promise?: Promise<T>;
};

export type QueryStore<T = any> = MapStore<QueryValue<T>> & {
	_: Symbol;
	key?: Key;
	invalidate: (...args: any[]) => void;
	revalidate: (...args: any[]) => void;
	mutate: (data?: T) => void;
	fetch: () => Promise<BetterFetchResponse<T>>;
};
type InternalQueryStore<T = any> = QueryStore<T> & {
	value: QueryValue<T>;
};

export type ManualMutator<Data = void> = (args: {
	data: Data;
	invalidate: Fn<[key: KeySelector]>;
	revalidate: Fn<[key: KeySelector]>;
	getCacheUpdater: <T = unknown>(
		key: Key,
		opts?: {
			shouldRevalidate?: boolean;
		},
	) => [updateCache: (newValue?: T) => void, currentValue: T | null];
}) => Promise<
	Pick<
		BetterFetchOption,
		"onRequest" | "onResponse" | "onSuccess" | "onError" | "onRetry"
	>
>;
export type MutateFn<Data, Result = unknown> = Data extends void
	? () => Promise<Result>
	: (data: Data) => Promise<Result>;
export type MutatorStore<Data = void, Result = unknown> = MapStore<{
	data: null | Data;
	error: null | BetterFetchError;
	isPending: boolean;
	mutate: MutateFn<Data, Result>;
}> & { mutate: MutateFn<Data, Result> };

export type QueryEvents = {
	FOCUS: Fn;
	RECONNECT: Fn;
	INVALIDATE_KEYS: Fn<[keySelector: KeySelector]>;
	REVALIDATE_KEYS: Fn<[keySelector: KeySelector]>;
	SET_CACHE: Fn<[keySelector: KeySelector, value?: unknown, full?: boolean]>;
};

export type OnErrorRetry = (opts: {
	error: unknown;
	key: Key;
	retryAttempt: number;
	errorRetryInterval: number;
}) => number | void | false | null | undefined;

type RefetchOptions = {
	dedupeTime?: number;
	revalidateOnFocus?: boolean;
	revalidateOnReconnect?: boolean;
	revalidateInterval?: number;
	cacheLifetime?: number;
	onErrorRetry?: OnErrorRetry | null | false;
	errorRetryInterval?: number;
};

export interface ClientOptions extends BetterFetchOption, RefetchOptions {
	baseURL: string;
	platform?: PlatformCompat;
}

//#endregion

type UseStore = <SomeAtom extends Atom>(atom: SomeAtom) => StoreValue<Atom>;

export const createClientFactory =
	<
		Config extends {
			useStore?: UseStore;
		},
	>(
		config?: Config,
	) =>
	<R extends Router | Router["endpoints"]>(options: ClientOptions) => {
		const { useStore } = config ?? {};
		const {
			isAppVisible,
			reconnectChangeSubscribe,
			visibilityChangeSubscribe,
		} = options.platform ?? browserPlatform;
		const fetch = createFetch<BetterFetchOption>(options);

		const events = createEvents<QueryEvents>();

		let focus = true;
		const cache = new Map<Key, CacheEntry>();
		visibilityChangeSubscribe(() => {
			focus = isAppVisible();
			if (focus) {
				events.emit("FOCUS");
			}
		});
		reconnectChangeSubscribe(() => events.emit("RECONNECT"));

		const revalidateOnInterval = new Map<KeyInput, number>();
		const errorInvalidateTimeouts = new Map<Key, number>();
		const runningQueries = new Map<Key, Promise<any>>();

		const getCachedValue = (key: Key) => {
			const fromCache = cache.get(key);
			if (!fromCache) {
				return [];
			}
			const cacheHit = (fromCache.expires || 0) > new Date().getTime();
			return cacheHit ? [fromCache.data, fromCache.error] : [null, null];
		};

		const querySymbol = Symbol();

		const runFetcher = async (
			{
				path,
				...fetchOptions
			}: BetterFetchOption &
				RefetchOptions & {
					path: string;
				},
			[key, keyParts]: [Key, KeyParts],
			store: InternalQueryStore,
			flags?: { isRefetch?: boolean },
		) => {
			if (!focus) {
				return;
			}

			const set = (value: QueryValue) => {
				if (store.key !== key) {
					return;
				}
				store.set(value);
				events.emit("SET_CACHE", key, value, true);
			};
			const setPending = (prev?: unknown) => {
				set({
					data: prev === undefined ? null : prev,
					error: null,
					isPending: true,
					isRefetching: !!flags?.isRefetch,
					promise: runningQueries.get(key),
				});
			};

			let {
				cacheLifetime = 4000,
				dedupeTime = Infinity,
				onErrorRetry = defaultOnErrorRetry,
				errorRetryInterval = 2000,
			} = fetchOptions;
			if (cacheLifetime < dedupeTime) {
				cacheLifetime = dedupeTime;
			}

			const now = getNow();
			if (runningQueries.has(key)) {
				if (!store.value.isPending) {
					setPending(getCachedValue(key)[0]);
				}
				return;
			}

			let cachedValue: any | void;
			let cachedError: any | void;
			const fromCache = cache.get(key);

			if (fromCache?.data !== void 0 || fromCache?.error) {
				[cachedValue, cachedError] = getCachedValue(key);

				if ((fromCache.created || 0) + dedupeTime > now) {
					if (store.value != cachedValue || store.value != cachedError) {
						set({
							data: cachedValue,
							error: cachedError,
							isPending: false,
							isRefetching: false,
						});
					}
					return;
				}
			}

			const endTask = startTask();
			try {
				clearInterval(errorInvalidateTimeouts.get(key));
				setPending(cachedValue);
				const promise = fetch(path, {
					// TODO: allow fetchOptions to be a function that accepts ...keyParts
					...fetchOptions,
					throw: true,
				});
				runningQueries.set(key, promise);
				const res = await promise;
				cache.set(key, {
					data: res,
					created: getNow(),
					expires: getNow() + cacheLifetime,
					error: null,
					retryAttempt: null,
				});
				set({
					data: res,
					isPending: false,
					isRefetching: false,
					error: null,
				});
			} catch (error: any) {
				const retryAttempt = (cache.get(key)?.retryAttempt || 0) + 1;
				cache.set(key, {
					error,
					created: getNow(),
					expires: getNow() + cacheLifetime,
					retryAttempt,
					data: null,
				});

				if (onErrorRetry) {
					// TODO: refactor to allow linear and exponential retry strategy
					const timer = onErrorRetry({
						error,
						key,
						retryAttempt,
						errorRetryInterval,
					});
					if (timer) {
						errorInvalidateTimeouts.set(
							key,
							setTimeout(() => {
								invalidateKeys(key);
								cache.set(key, {
									data: null,
									error: null,
									created: null,
									expires: null,
									retryAttempt,
								});
							}, timer) as unknown as number,
						);
					}
				}
				set({
					data: store.value.data,
					isPending: false,
					isRefetching: false,
					error,
				});
			} finally {
				endTask();
				runningQueries.delete(key);
			}
		};

		type API = WithoutServerOnly<
			R extends { endpoints: Record<string, Endpoint> } ? R["endpoints"] : R
		>;
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

		const useQuery = <
			OPT extends O,
			K extends keyof OPT & string,
			C extends InferContext<OPT[K]>,
		>(
			keyInput: KeyInput,
			path: K,
			...opts: HasRequired<C> extends true
				? [
						WithRequired<
							BetterFetchOption<C["body"], C["query"], C["params"]>,
							keyof RequiredOptionKeys<C>
						> &
							RefetchOptions,
					]
				: [
						(BetterFetchOption<C["body"], C["query"], C["params"]> &
							RefetchOptions)?,
					]
		): Config extends {
			useStore: UseStore;
		}
			? QueryValue<
					Awaited<ReturnType<OPT[K] extends Endpoint ? OPT[K] : never>>
				>
			: QueryStore<
					Awaited<ReturnType<OPT[K] extends Endpoint ? OPT[K] : never>>
				> => {
			const queryStore: InternalQueryStore = map({
				isPending: false,
				isRefetching: false,
				data: null,
				error: null,
			});
			const config = {
				...options,
				...opts[0],
			};

			queryStore._ = querySymbol;
			queryStore.invalidate = () => {
				const { key } = queryStore;
				if (key) {
					invalidateKeys(key);
				}
			};
			queryStore.revalidate = () => {
				const { key } = queryStore;
				if (key) {
					revalidateKeys(key);
				}
			};
			queryStore.mutate = (data) => {
				const { key } = queryStore;
				if (key) {
					mutateCache(key, data);
				}
			};
			queryStore.fetch = async () => {
				let resolve: (value: BetterFetchResponse<any>) => any;
				const promise = new Promise<BetterFetchResponse<any>>(
					(r) => (resolve = r),
				);
				const unsub = queryStore.listen(({ error, data }) => {
					if (error !== null) resolve({ error, data: null });
					if (data !== null) resolve({ data, error: null });
				});
				return promise.finally(unsub);
			};

			let keysInternalUnsub: Fn | null = null;
			let prevKey: Key | null = null;
			let prevKeyParts: KeyParts | null = null;
			let keyUnsub: Fn | null = null;
			let keyStore: ReturnType<typeof getKeyStore>[0] | null = null;

			let evtUnsubs: Fn[] = [];

			onStart(queryStore, () => {
				const firstRun = keysInternalUnsub === null;
				[keyStore, keysInternalUnsub] = getKeyStore(keyInput, querySymbol);
				keyUnsub = keyStore.subscribe((currentKeys) => {
					if (currentKeys === null) {
						prevKey = prevKeyParts = null;
						queryStore.key = void 0;
						queryStore.set({
							isPending: false,
							isRefetching: false,
							data: null,
							error: null,
						});
						return;
					}

					const [newKey, keyParts] = currentKeys;
					queryStore.key = newKey;
					runFetcher(
						{
							path,
							...config,
						},
						[newKey, keyParts],
						queryStore,
						{ isRefetch: !firstRun },
					);
					prevKey = newKey;
					prevKeyParts = keyParts;
				});

				const currentKeyValue = keyStore.get();
				if (currentKeyValue) {
					[prevKey, prevKeyParts] = currentKeyValue;
					if (firstRun) {
						handleNewListener();
					}
				}

				const {
					revalidateInterval = 0,
					revalidateOnFocus,
					revalidateOnReconnect,
				} = config;
				const runRefetcher = () => {
					if (prevKey) {
						runFetcher(
							{
								path,
								...config,
							},
							[prevKey, prevKeyParts!],
							queryStore,
							{ isRefetch: true },
						);
					}
				};

				if (revalidateInterval > 0) {
					revalidateOnInterval.set(
						keyInput,
						setInterval(runRefetcher, revalidateInterval) as unknown as number,
					);
				}
				if (revalidateOnFocus) {
					evtUnsubs.push(events.on("FOCUS", runRefetcher));
				}
				if (revalidateOnReconnect) {
					evtUnsubs.push(events.on("RECONNECT", runRefetcher));
				}

				const cacheKeyChangeHandler = (keySelector: KeySelector) => {
					if (prevKey && testKeyAgainstSelector(prevKey, keySelector)) {
						runFetcher(
							{
								path,
								...config,
							},
							[prevKey, prevKeyParts!],
							queryStore,
						);
					}
				};

				evtUnsubs.push(
					events.on("INVALIDATE_KEYS", cacheKeyChangeHandler),
					events.on("REVALIDATE_KEYS", cacheKeyChangeHandler),
					events.on("SET_CACHE", (keySelector, data, full) => {
						if (
							prevKey &&
							testKeyAgainstSelector(prevKey, keySelector) &&
							queryStore.value !== data &&
							queryStore.value.data !== data
						) {
							queryStore.set(
								(full
									? data
									: {
											data,
											isPending: false,
											isRefetching: false,
										}) as QueryValue,
							);
						}
					}),
				);
			});

			const handleNewListener = () => {
				if (prevKey && prevKeyParts) {
					runFetcher(
						{
							path,
							...config,
						},
						[prevKey, prevKeyParts],
						queryStore,
					);
				}
			};

			const originalListen = queryStore.listen;
			queryStore.listen = (listener: any) => {
				const unsub = originalListen(listener);
				listener(queryStore.value);
				handleNewListener();
				return unsub;
			};

			onStop(queryStore, () => {
				queryStore.value = {
					isPending: false,
					isRefetching: false,
					data: null,
					error: null,
				};
				keysInternalUnsub?.();
				evtUnsubs.forEach((fn) => fn());
				evtUnsubs = [];
				keyUnsub?.();
				clearInterval(revalidateOnInterval.get(keyInput));
			});

			return (useStore ? useStore(queryStore) : queryStore) as any;
		};

		// TODO: Types
		const useMutation = (
			path: string,
			events?: ManualMutator<any>,
			opts?: { throttleCalls?: boolean },
		): MutatorStore<any, any> => {
			const { throttleCalls = true } = opts ?? {};

			const mutate = async (data: BetterFetchOption) => {
				data = {
					...options,
					...data,
				};
				// Adding extremely basic client-side throttling
				// Calling mutate function multiple times before previous call resolved will result
				// in void return.
				if (throttleCalls && store.value?.isPending) {
					return;
				}

				const keysToInvalidate: KeySelector[] = [];
				const keysToRevalidate: KeySelector[] = [];

				const safeSetKey = <K extends keyof StoreValue<typeof store>>(
					k: K,
					v: StoreValue<typeof store>[K],
				) => {
					// If you already have unsubscribed from this mutation store, we do not
					// want to overwrite the default unset value. We just let the set values to
					// be forgotten forever.
					if (store.lc) {
						store.setKey(k, v);
					}
				};
				try {
					store.set({
						error: null,
						data: null,
						mutate: mutate as MutateFn<void, unknown>,
						isPending: true,
					});
					const fetchEvents = await events?.({
						data,
						invalidate: (key: KeySelector) => {
							// We automatically postpone key invalidation up until mutator is run
							keysToInvalidate.push(key);
						},
						revalidate: (key: KeySelector) => {
							// We automatically postpone key invalidation up until mutator is run
							keysToRevalidate.push(key);
						},
						getCacheUpdater: <T = unknown>(
							key: Key,
							opts?: {
								shouldRevalidate?: boolean;
							},
						) => {
							const shouldRevalidate = opts?.shouldRevalidate ?? true;

							const updateCache = (newVal?: T) => {
								mutateCache(key, newVal);
								if (shouldRevalidate) {
									keysToInvalidate.push(key);
								}
							};
							const currentValue = (cache.get(key)?.data ?? null) as T | null;

							return [updateCache, currentValue];
						},
					});
					const result = await fetch(path, {
						...data,
						async onRequest(context) {
							const modifiedContext = {
								...context,
								...((await fetchEvents?.onRequest?.(context)) ?? {}),
							};
							return {
								...modifiedContext,
								...((await data?.onRequest?.(modifiedContext)) ?? {}),
							};
						},
						async onResponse(context) {
							const modifiedResponse =
								(await fetchEvents?.onResponse?.(context)) ?? context.response;

							return await data?.onResponse?.(
								"response" in modifiedResponse
									? modifiedResponse
									: {
											request: context.request,
											response: modifiedResponse,
										},
							);
						},
						async onSuccess(context) {
							await fetchEvents?.onSuccess?.(context);
							await data?.onSuccess?.(context);
						},
						async onError(context) {
							await fetchEvents?.onError?.(context);
							await data?.onError?.(context);
						},
						async onRetry(context) {
							await fetchEvents?.onRetry?.(context);
							await data?.onRetry?.(context);
						},
						throw: true,
					});
					safeSetKey("data", result as any);
					return result;
				} catch (error) {
					safeSetKey("error", error as BetterFetchError);
					store.setKey("error", error as BetterFetchError);
				} finally {
					safeSetKey("isPending", false);
					keysToInvalidate.forEach(invalidateKeys);
					keysToRevalidate.forEach(revalidateKeys);
				}
			};
			const store: MutatorStore = map({
				mutate: mutate as MutateFn<unknown, unknown>,
				isPending: false,
				data: null,
				error: null,
			});
			onStop(store, () => {
				store.set({
					mutate: mutate as MutateFn<void, any>,
					isPending: false,
					data: null,
					error: null,
				});
			});
			store.mutate = mutate as MutateFn<void, unknown>;
			return (useStore ? useStore(store) : store) as any;
		};

		const iterOverCache = (keySelector: KeySelector, cb: Fn<[string]>) => {
			for (const key of cache.keys()) {
				if (testKeyAgainstSelector(key, keySelector)) {
					cb(key);
				}
			}
		};
		const invalidateKeys = (keySelector: KeySelector) => {
			iterOverCache(keySelector, (key) => cache.delete(key));
			events.emit("INVALIDATE_KEYS", keySelector);
		};
		const revalidateKeys = (keySelector: KeySelector) => {
			iterOverCache(keySelector, (key) => {
				const cached = cache.get(key);
				if (cached) {
					cache.set(key, { ...cached, created: -Infinity });
				}
			});
			events.emit("REVALIDATE_KEYS", keySelector);
		};
		const mutateCache = (keySelector: KeySelector, data?: unknown) => {
			iterOverCache(keySelector, (key) => {
				if (data === void 0) {
					cache.delete(key);
				} else {
					cache.set(key, {
						data,
						created: getNow(),
						expires: getNow() + (options.cacheLifetime ?? 8000),
						error: null,
						retryAttempt: null,
					});
				}
			});
			events.emit("SET_CACHE", keySelector, data);
		};

		type WithInputKey<T> = T & {
			queryKey?: Key;
		};

		const $fetch = async <
			OPT extends O,
			K extends keyof OPT,
			C extends InferContext<OPT[K]>,
		>(
			path: K,
			...opts: HasRequired<C> extends true
				? [
						WithInputKey<
							WithRequired<
								BetterFetchOption<C["body"], C["query"], C["params"]>,
								keyof RequiredOptionKeys<C>
							>
						>,
					]
				: [WithInputKey<BetterFetchOption<C["body"], C["query"], C["params"]>>?]
		): Promise<
			BetterFetchResponse<
				Awaited<ReturnType<OPT[K] extends Endpoint ? OPT[K] : never>>
			>
		> => {
			const { queryKey, ...fetchOptions } = opts[0] ?? {};

			if (!queryKey) {
				return (await fetch(path as string, fetchOptions)) as any;
			}

			// TODO: Pass refetch options to $fetch params
			const cfg = {
				...options,
				...fetchOptions,
			};
			let { cacheLifetime = 4000, dedupeTime = Infinity } = cfg;
			if (cacheLifetime < dedupeTime) {
				cacheLifetime = dedupeTime;
			}

			let cachedValue: any | void;
			let cachedError: any | void;
			const fromCache = cache.get(queryKey);

			if (fromCache?.data !== void 0 || fromCache?.error) {
				[cachedValue, cachedError] = getCachedValue(queryKey);

				if (
					(fromCache.created || 0) + (cfg.dedupeTime ?? Infinity) >
					getNow()
				) {
					if (cfg.throw) {
						if (cachedError !== null) {
							throw cachedError;
						}
						return cachedValue;
					}
					return {
						data: cachedValue,
						error: cachedError,
					};
				}
			}

			return await fetch(path as string, {
				...fetchOptions,
				async onSuccess(context) {
					cache.set(queryKey, {
						data: context.data,
						created: getNow(),
						expires: getNow() + cacheLifetime,
						error: null,
						retryAttempt: null,
					});
					await fetchOptions?.onSuccess?.(context);
				},
				async onError(context) {
					cache.set(queryKey, {
						error: context.error,
						created: getNow(),
						expires: getNow() + cacheLifetime,
						data: null,
						retryAttempt: (cache.get(queryKey)?.retryAttempt || 0) + 1,
					});
					await fetchOptions?.onError?.(context);
				},
			});
		};

		return Object.assign($fetch, {
			useQuery,
			useMutation,
			invalidateKeys,
			revalidateKeys,
			mutateCache,
			$InferEndpoints: {} as API,
		});
	};

export const createClient = createClientFactory();
