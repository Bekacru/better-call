import {
	afterEach,
	beforeAll,
	describe,
	expect,
	expectTypeOf,
	vi,
} from "vitest";
import { createClient } from "../client";
import { z } from "zod/v4";
import {
	createEndpoint,
	createMiddleware,
	createRouter,
} from "@better-call/core";
import { clientTest } from "./test-client";

describe("client", () => {
	const getEndpoint = createEndpoint(
		"/test2",
		{
			method: "GET",
			query: z.object({
				hello: z.string(),
			}),
		},
		async (ctx) => {
			return {
				status: 200,
				body: {
					hello: "world",
				},
			};
		},
	);
	const endpoint = createEndpoint(
		"/test",
		{
			method: "POST",
			body: z.object({
				hello: z.string(),
			}),
		},
		async (ctx) => {
			return {
				status: 200,
				body: {
					hello: "world",
				},
			};
		},
	);

	const endpoint2 = createEndpoint(
		"/test3",
		{
			method: "GET",
			query: z.object({
				hello: z.string().optional(),
			}),
		},
		async (ctx) => {
			return {
				status: 200,
				body: {
					hello: "world",
				},
			};
		},
	);

	const test = clientTest(
		createRouter({
			endpoint,
			endpoint2,
			getEndpoint,
		}),
	);

	test("should send request and get response", async ({ client }) => {
		expectTypeOf<Parameters<typeof client>[0]>().toExtend<
			"@post/test" | "/test2" | "/test3"
		>();

		const response = await client("@post/test", {
			body: {
				hello: "world",
			},
		});
		expect(response.data).toMatchObject({
			status: 200,
			body: { hello: "world" },
		});
	});

	test("should infer types", async ({ client }) => {
		const res = await client("@post/test", {
			body: {
				hello: "world",
			},
		});

		expectTypeOf<Parameters<typeof client>[0]>().toExtend<
			"@post/test" | "/test2" | "/test3"
		>();

		client("@post/test", {
			body: {
				//@ts-expect-error
				hello: 1,
			},
		});

		client("/test2", {
			query: {
				//@ts-expect-error
				hello: 2,
			},
		});
		client("/test3", {
			query: {},
		});
	});

	test("should call endpoint n", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "POST",
				body: z.object({
					hello: z.string(),
				}),
			},
			async (ctx) => {
				return {
					status: 200,
					body: {
						hello: "world",
					},
				};
			},
		);
		const endpoint2 = createEndpoint(
			"/test2",
			{
				method: "GET",
			},
			async (ctx) => {
				return {
					status: 200,
					body: {
						hello: "world",
					},
				};
			},
		);

		const router = createRouter({
			endpoint,
			endpoint2,
		});

		const client = createClient<typeof router>({
			baseURL: "http://localhost:3000",
		});
		await client("@post/test", {
			body: {
				hello: "world",
			},
			customFetchImpl: async (url, init) => {
				expect(url.toString()).toBe("http://localhost:3000/test");
				expect(init?.method).toBe("POST");
				expect(init?.body).toBe('{"hello":"world"}');
				return new Response(null);
			},
		});
		await client("/test2", {
			customFetchImpl: async (url, init) => {
				expect(url.toString()).toBe("http://localhost:3000/test2");
				expect(init?.method).toBe("GET");
				return new Response(null);
			},
		});
	});

	test("should infer from custom creator", () => {
		const cr2 = createEndpoint.create({
			use: [
				createMiddleware(async (ctx) => {
					return {
						something: "",
					};
				}),
			],
		});

		const endpoint = cr2(
			"/test",
			{
				method: "POST",
			},
			async (ctx) => {
				return {
					status: 200,
					body: {
						hello: "world",
					},
				};
			},
		);
		const endpoints = {
			endpoint,
		};
		const client = createClient<typeof endpoints>({
			baseURL: "http://localhost:3000",
		});
		expectTypeOf<Parameters<typeof client>[0]>().toMatchTypeOf<"@post/test">();
	});

	test("should not require an empty object", async () => {
		const router = createRouter({
			endpoint: createEndpoint(
				"/test",
				{
					method: "POST",
				},
				async (ctx) => {
					return { status: 200, body: { hello: "world" } };
				},
			),
			getEndpoint: createEndpoint(
				"/test2",
				{
					method: "GET",
				},
				async (ctx) => {
					return { status: 200, body: { hello: "world" } };
				},
			),
		});
		const client = createClient<typeof router>({
			baseURL: "http://localhost:3000",
			customFetchImpl: async (url, init) => {
				return new Response(null);
			},
		});
		expectTypeOf<Parameters<typeof client>[0]>().toExtend<
			"@post/test" | "/test2"
		>();
		client("@post/test");
		client("/test2");
	});

	// TODO: test cache
	test.todo(
		"should not read/mutate cache when no queryKey provided",
		async () => {},
	);
});

describe("stateful client", () => {
	beforeAll(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	const test = clientTest();

	test.todo("should fetch once for multiple subscriptions", async () => {});
	test.todo("should work with numerical keys", async () => {});
	test.todo("should work with boolean keys", async () => {});
	test.todo("should work with string-based keys", async () => {});
	test.todo(
		"should share values between stores with same keys",
		async () => {},
	);
	test.todo("should propagate pending state", async () => {});
	test.todo("should propagate error state", async () => {});
	test.todo("should provide a promise", async () => {});
	test.todo("should transition through states correctly", async () => {});
	test.todo("should accept stores as keys", async () => {});
	test.todo("should accept query stores as keys", async () => {});
	test.todo("should not send requests before dedupe time", async () => {});
	test.todo(
		"should fetch once when changing multiple atom-based keys",
		async () => {},
	);
	test.todo(
		"nullable keys should disable fetching and unset store value, but enable once set",
		async () => {},
	);
	test.todo(
		"should use stale cache with setting pending state",
		async () => {},
	);
	test.todo("should drop cache for inactive stores", async () => {});
	test.todo(
		"internal nanostores cache is dropped between key changes",
		async () => {},
	);
	test.todo(
		"should create interval fetching, and disable once key changes",
		async () => {},
	);
	test.todo(
		"should not store state for delayed request if current key has already changed",
		async () => {},
	);
	test.todo(
		"should use pre-set cache when fetching from a completely new context",
		async () => {},
	);
	test.todo(
		"`cacheLifetime` higher than `dedupeTime` leads to stale cache showing despite running fetcher",
		async () => {},
	);
	test.todo("should dedupe error responses", async () => {});
	test.todo("`onErrorRetry` works", async () => {});

	describe("refetch logic", () => {
		test.todo("should refetch on focus and reconnect", async () => {});
		test.todo("should not fire interval when out of focus", async () => {});
		test.todo(
			"should not update store if data has a stable identity",
			async () => {},
		);
		test.todo(
			"should not reset the store's value after getting a revalidate/invalidate trigger if there's an active subscriber",
			async () => {},
		);
	});

	describe("mutator", () => {
		test.todo("should transition through states correctly", async () => {});
		test.todo(
			"should unset value after last subscriber stops listening",
			async () => {},
		);
		test.todo(
			"should ensure client-side idempotency of mutation calls",
			async () => {},
		);
		test.todo(
			"client-side idempotency of mutation calls can be toggled off",
			async () => {},
		);
		test.todo(
			"should transition correctly when there's no subscribers",
			async () => {},
		);
		test.todo(
			"invalidates keys; invalidation ignores dedupe; invalidation ignores cache; always invalidates after running mutation",
			async () => {},
		);
		test.todo("local mutation; invalidation afterwards", async () => {});
		test.todo("local mutation; invalidation disabled", async () => {});
	});

	describe("global invalidator and mutator", () => {
		test.todo("global invalidator works", async () => {});
		test.todo("global mutation works", async () => {});
		test.todo(
			"global mutation treats undefined as instruction to wipe key",
			async () => {},
		);
	});
});
