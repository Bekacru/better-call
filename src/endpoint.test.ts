import { describe, expect, expectTypeOf, it } from "vitest";
import { createEndpoint } from "./endpoint";
import { z } from "zod";
import { APIError } from "./error";
import { createMiddleware } from "./middleware";

describe("validation", (it) => {
	it("should validate body and throw validation error", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				body: z.object({
					name: z.string(),
				}),
			},
			async (ctx) => {
				ctx.headers;
				return ctx.body;
			},
		);

		await expect(
			endpoint({
				//@ts-expect-error
				body: { name: 1 },
			}),
		).rejects.toThrowError(`Validation error: Expected string, received number at "name"`);
	});

	it("should validate query and throw validation error", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.object({
					name: z.string(),
				}),
			},
			async (ctx) => {
				return ctx.query;
			},
		);

		await expect(
			endpoint({
				//@ts-expect-error
				query: { name: 1 },
			}),
		).rejects.toThrowError(`Validation error: Expected string, received number at "name"`);
	});

	it("should validate the body and return the body", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				body: z.object({
					name: z.string().transform((val) => `${val}-validated`),
				}),
			},
			async (ctx) => {
				return ctx.body;
			},
		);
		const response = await endpoint({
			body: {
				name: "test",
			},
		});
		expect(response.name).toBe("test-validated");
	});

	it("should validate the body and return the query", async () => {
		const endpoint = createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.object({
					name: z.string().transform((val) => `${val}-validated`),
				}),
			},
			async (ctx) => {
				return ctx.query;
			},
		);
		const response = await endpoint({
			query: {
				name: "test",
			},
		});
		expect(response.name).toBe("test-validated");
	});
});

describe("types", async () => {
	it("body", async () => {
		createEndpoint(
			"/test",
			{
				method: "GET",
				body: z.object({
					name: z.string(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.body).toEqualTypeOf<{ name: string }>();
			},
		);

		createEndpoint(
			"/test",
			{
				method: "GET",
				body: z.object({
					name: z.string().optional(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.body).toEqualTypeOf<{ name?: string }>();
			},
		);

		createEndpoint(
			"/test",
			{
				method: "GET",
				body: z
					.object({
						name: z.string(),
					})
					.optional(),
			},
			async (ctx) => {
				expectTypeOf(ctx.body).toEqualTypeOf<{ name: string } | undefined>();
			},
		);

		createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.record(z.string()),
				metadata: {
					$Infer: {
						body: {} as {
							hello: "world";
						},
					},
				},
			},
			async (c) => {
				expectTypeOf(c.body).toMatchTypeOf<{
					hello: "world";
				}>();
			},
		);
	});

	it("query", async () => {
		createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.object({
					name: z.string(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.query).toEqualTypeOf<{ name: string }>();
			},
		);

		createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.object({
					name: z.string().optional(),
				}),
			},
			async (ctx) => {
				expectTypeOf(ctx.query).toEqualTypeOf<{ name?: string }>();
			},
		);

		createEndpoint(
			"/test",
			{
				method: "GET",
				query: z.optional(
					z.object({
						name: z.string(),
					}),
				),
			},
			async (ctx) => {
				expectTypeOf(ctx.query).toEqualTypeOf<{ name: string } | undefined>();
			},
		);

		createEndpoint(
			"/path",
			{
				method: "POST",
				body: z.record(z.string()),
				metadata: {
					$Infer: {
						query: {} as {
							hello: "world";
						},
					},
				},
			},
			async (c) => {
				expectTypeOf(c.query).toMatchTypeOf<{
					hello: "world";
				}>();
			},
		);
	});

	it("params", async () => {
		createEndpoint(
			"/:id",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toEqualTypeOf<{ id: string }>();
			},
		);

		createEndpoint(
			"/leading-path/:id",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toEqualTypeOf<{ id: string }>();
			},
		);

		createEndpoint(
			"/leading-path/:id/:name",
			{
				method: "GET",
			},
			async (ctx) => {
				ctx.params;
				expectTypeOf(ctx.params).toEqualTypeOf<{ id: string; name: string }>();
			},
		);
	});

	it("wildcard params", async () => {
		createEndpoint(
			"/api/*",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toEqualTypeOf<{ _: string }>();
			},
		);

		createEndpoint(
			"/api/:id/*",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.params).toEqualTypeOf<{ _: string; id: string }>();
			},
		);
	});

	it("method", async () => {
		createEndpoint(
			"/test",
			{
				method: "GET",
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toEqualTypeOf<"GET">();
			},
		);

		const endpoint = createEndpoint(
			"/test",
			{
				method: ["POST", "GET"],
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toEqualTypeOf<"POST" | "GET">();
			},
		);
		//@ts-expect-error - method should be required
		endpoint({});
		const wildCardMethodEndpoint = createEndpoint(
			"/test",
			{
				method: "*",
			},
			async (ctx) => {
				expectTypeOf(ctx.method).toEqualTypeOf<
					"POST" | "GET" | "DELETE" | "PUT" | "PATCH"
				>();
			},
		);
		//@ts-expect-error -
		wildCardMethodEndpoint({});
	});
	it("response", async () => {
		const endpoint1 = createEndpoint(
			"/test",
			{
				method: "GET",
			},
			async (ctx) => {
				return { name: "test" };
			},
		);
		const jsonResponse1 = await endpoint1();
		expectTypeOf(jsonResponse1).toEqualTypeOf<{ name: string }>();
		const objResponse1 = await endpoint1({ asResponse: true });
		expectTypeOf(objResponse1).toEqualTypeOf<Response>();
	});
});

describe("response", () => {
	describe("flat", () => {
		it("should return primitive values", async () => {
			for (const value of [1, "hello", true]) {
				const endpoint = createEndpoint(
					"/path",
					{
						method: "POST",
					},
					async (ctx) => {
						return value;
					},
				);
				const response = await endpoint();
				expect(response).toBe(value);
			}
		});
	});

	describe("json", () => {
		it("should return a js object response on direct call", async () => {
			const endpoint = createEndpoint(
				"/path",
				{
					method: "POST",
				},
				async (ctx) => {
					return ctx.json({ test: "response" });
				},
			);
			const response = await endpoint();
			expect(response).toMatchObject({
				test: "response",
			});
		});
	});

	describe("as-response", () => {
		it("should return a response object", async () => {
			const responses = [
				{
					type: "number",
					value: 1,
				},
				{
					type: "string",
					value: "hello world!",
				},
				{
					type: "object",
					value: {
						hello: "world",
					},
				},
				{
					type: "object",
					value: ["1", "2", "3"],
				},
			];
			for (const value of responses) {
				const endpoint = createEndpoint(
					"/path",
					{
						method: "POST",
					},
					async () => {
						return value.value;
					},
				);
				const response = await endpoint({
					asResponse: true,
				});
				const body = await response.text();
				if (value.type !== "object") {
					expect(body).toBe(value.value.toString());
				} else {
					expect(body).toMatch(JSON.stringify(value.value));
				}
			}
		});
	});

	describe("redirect", () => {
		it("should return redirect response", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					return c.redirect("/");
				},
			);
			const response = await endpoint();
			expect(response).instanceOf(APIError);
			expect(response.status).toBe("FOUND");
			expect(response.statusCode).toBe(302);
		});
	});

	describe("set-headers", () => {
		it("should set headers", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					c.setHeader("hello", "world");
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			expect(response.headers.get("hello")).toBe("world");

			const response2 = await endpoint({
				returnHeaders: true,
			});
			expect(response2.headers.get("hello")).toBe("world");
		});
	});

	describe("API Error", () => {
		it("should throw API Error", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					throw c.error("NOT_FOUND");
				},
			);
			await expect(endpoint()).rejects.toThrowError(APIError);
		});

		it("should return error Response", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					throw c.error("NOT_FOUND");
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			expect(response.status).toBe(404);
		});

		it("should return error Response with it's body", async () => {
			const endpoint = createEndpoint(
				"/endpoint",
				{
					method: "POST",
				},
				async (c) => {
					throw c.error("BAD_REQUEST", {
						message: "error message",
					});
				},
			);
			const response = await endpoint({
				asResponse: true,
			});
			const body = await response.json();
			expect(response.status).toBe(400);
			expect(body).toMatchObject({
				message: "error message",
			});
		});
	});
	describe("json", async () => {
		it("should return the json directly", async () => {
			const endpoint = createEndpoint(
				"/",
				{
					method: "GET",
				},
				async (c) => {
					return c.json(
						{ name: "hello" },
						new Response(
							JSON.stringify({
								client: "hello",
							}),
						),
					);
				},
			);
			const response = await endpoint();
			expect(response).toMatchObject({
				name: "hello",
			});
		});
	});
});

describe.only("creator", () => {
	it("should use creator context", async () => {
		const creator = createEndpoint.create({
			use: [
				createMiddleware(async () => {
					return {
						hello: "world",
					};
				}),
			],
		});
		const endpoint = creator(
			"/path",
			{
				method: "POST",
			},
			async (c) => {
				return c.context;
			},
		);
		const response = await endpoint();
		expect(response).toMatchObject({
			hello: "world",
		});
	});

	it("should be able to combine with endpoint middleware", async () => {
		const creator = createEndpoint.create({
			use: [
				createMiddleware(async () => {
					return {
						hello: "world",
					};
				}),
			],
		});
		const endpoint = creator(
			"/path",
			{
				method: "POST",
				use: [
					createMiddleware(async () => {
						return {
							test: "payload",
						};
					}),
				],
			},
			async (c) => {
				return c.context;
			},
		);
		const response = await endpoint();
		expect(response).toMatchObject({
			hello: "world",
			test: "payload",
		});
	});
});
