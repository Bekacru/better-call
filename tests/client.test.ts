import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint, createEndpointCreator, createRouter } from "../src";
import { createClient } from "../src/client";
import { z } from "zod";

describe("client", () => {
	it("should infer types", () => {
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
		const router = createRouter({
			endpoint,
			getEndpoint,
		});

		const client = createClient<typeof router>({
			baseURL: "http://localhost:3000",
		});

		expectTypeOf<Parameters<typeof client>[0]>().toMatchTypeOf<"@post/test" | "/test2">();

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
	});

	it("should call endpoint n", async () => {
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

	it("should infer from custom creator", () => {
		const cr2 = createEndpointCreator<{
			otherProp: string;
			context: {
				hello: string;
			};
		}>();
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
		client("@post/test");
	});
});
