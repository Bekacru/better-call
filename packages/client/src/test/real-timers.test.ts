import { describe, expect, vi } from "vitest";
import type { FetchEsque } from "@better-fetch/fetch";
import { noop } from "../utils";
import { allTasks, atom } from "nanostores";
import { createClient } from "../client";
import { clientTest } from "./test-client";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("real timers", async () => {
	const test = clientTest();

	test("should correct events in conditional fetcher", async ({ client }) => {
		const $conditional = atom<void | string>();

		const $store = client.useQuery(["some-key", $conditional], "/read", {
			query: {
				id: "abc",
			},
		});

		let events: any[] = [];
		const unsub = $store.listen((v) => {
			events.push(v);
		});

		expect(events[0]).toMatchObject({ isPending: false });
		$conditional.set("123");
		await delay(0);
		expect(events[1]).toMatchObject({ isPending: true });

		await delay(30);

		expect(events[2]).toMatchObject({
			isPending: false,
			data: "abc",
		});
		unsub();
	});

	test("should correct events in non-conditional fetcher", async ({
		client,
	}) => {
		const $store = client.useQuery(["some-key"], "/read", {
			query: {
				id: "abc",
			},
		});

		let events: any[] = [];
		const unsub = $store.listen((v) => {
			events.push(v);
		});

		expect(events[0]).toMatchObject({ isPending: true });

		await delay(30);

		expect(events[1]).toMatchObject({
			isPending: false,
			data: "abc",
		});

		unsub();
	});

	test("useQuery should call fetch and update store", async ({ client }) => {
		const $query = client.useQuery("some-key", "/read", {
			query: {
				id: "some-value",
			},
		});
		let val: any = {};
		const unsub = $query.listen((v) => (val = v));
		expect(val.isPending).toBe(true);
		expect(val.data).toBeNull();
		await $query.fetch();
		expect(val.isPending).toBe(false);
		expect(val.data).toBe("some-value");
		unsub();
	});

	test("useMutation should call fetch and update store", async ({
		client,
		customFetchImpl,
	}) => {
		const $store = client.useMutation("/write");

		let val = $store.get();
		const unsub = $store.listen((v) => (val = v));

		expect(val.isPending).toBe(false);

		const res = await $store.mutate({ body: { msg: "hello" } });

		await delay(0);

		expect(customFetchImpl).toHaveBeenCalledOnce();
		expect(val.isPending).toBe(false);
		expect(val.data).toBe("hello");
		expect(res).toBe("hello");
		unsub();
	});

	test("useMutation should throttle multiple calls", async ({
		client,
		customFetchImpl,
	}) => {
		const $store = client.useMutation("/write");

		await $store.mutate({ body: { msg: "a" } });
		await $store.mutate({ body: { msg: "b" } });

		await new Promise((r) => setTimeout(r, 150));
		expect(customFetchImpl).toHaveBeenCalledTimes(1);
	});

	test("useMutation should allow updating cache", async ({ client }) => {
		const $query = client.useQuery("some-key", "/read", {
			query: {
				id: "5",
			},
		});
		await $query.fetch();

		let queryVal = $query.get();
		const unsubQuery = $query.listen((v) => (queryVal = v));

		const $store = client.useMutation(
			"/write",
			async ({ data, getCacheUpdater, invalidate }) => {
				const [updateCache, currentValue] = getCacheUpdater("some-key", {
					shouldRevalidate: false,
				});

				return {
					onRequest(context) {
						updateCache(data.body.msg);
					},
					onError(context) {
						updateCache(currentValue);
					},
				};
			},
		);

		let val = $store.get();
		const unsub = $store.listen((v) => (val = v));

		expect(val.isPending).toBe(false);

		const res = await $store.mutate({ body: { msg: "hello" } });
		expect(val.isPending).toBe(false);
		expect(val.data).toBe("hello");
		expect(res).toBe("hello");
		await $query.fetch();
		expect(queryVal.data).toBe("hello");
		unsub();
		unsubQuery();
	});

	test("should add a nanostore task when running fetchers", async ({
		client,
	}) => {
		const keys = ["some", "key"];
		const $store = client.useQuery(keys, "/read", {
			query: {
				id: "some-value",
			},
		});
		$store.subscribe(noop);

		await allTasks();

		expect($store.get().data).toEqual("some-value");
	});

	test("should allow lazy fetching", async ({ endpoints }) => {
		const keys = ["some", "key"];
		let shouldError = false;
		const customFetchImpl = vi.fn().mockImplementation((async (url, init) => {
			return await new Promise<Response>((resolve, reject) =>
				setTimeout(() => {
					if (shouldError) {
						reject("err");
					} else {
						resolve(new Response("ok"));
					}
				}, 10),
			);
		}) satisfies FetchEsque);
		const client = createClient<typeof endpoints>({
			baseURL: "http://localhost:3000",
			customFetchImpl,
			dedupeTime: 30,
			cacheLifetime: 30,
		});

		const $store = client.useQuery(keys, "/read", {
			query: {
				id: "2",
			},
		});

		let res = await $store.fetch();
		expect(res).toEqual({ data: "ok", error: null });
		expect(customFetchImpl).toHaveBeenCalledOnce();

		await $store.fetch();
		await $store.fetch();
		await $store.fetch();
		expect(customFetchImpl).toHaveBeenCalledOnce();

		await delay(30);

		shouldError = true;
		res = await $store.fetch();
		expect(res).toEqual({ data: null, error: "err" });
		expect(customFetchImpl).toHaveBeenCalledTimes(2);
	});
});
