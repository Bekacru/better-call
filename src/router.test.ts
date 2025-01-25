import { describe, expect, it } from "vitest";
import { createEndpoint, type Endpoint } from "./endpoint";
import { createRouter } from "./router";
import { z } from "zod";

describe("router", () => {
	it("should be able to return simple response", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async () => {
				return "hello world";
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost:3000");
		const response = await router.handler(request);
		const text = await response.text();
		expect(text).toBe("hello world");
	});
	it("should be able to router properly", async () => {
		const routes: {
			path: string;
			method: string;
			body?: any;
		}[] = [
			{
				path: "/",
				method: "GET",
			},
			{
				path: "/post",
				method: "POST",
			},
			{
				path: "/patch",
				method: "PATCH",
			},
			{
				path: "/delete",
				method: "DELETE",
			},
			{
				path: "/put",
				method: "PUT",
			},
		];
		const endpoints: Record<string, Endpoint> = {};
		for (const route of routes) {
			const endpoint = createEndpoint(
				route.path,
				{
					method: route.method as "GET",
				},
				async () => {
					return route.path;
				},
			);
			endpoints[route.path] = endpoint;
		}

		const router = createRouter(endpoints);
		for (const route of routes) {
			const request = new Request(`http://localhost:3000${route.path}`, {
				method: route.method,
			});
			const response = await router.handler(request).then((res) => res.text());
			expect(response).toBe(route.path);
		}
	});

	it("requests with a body", async () => {
		const endpoint = createEndpoint(
			"/post",
			{
				method: "POST",
				body: z.object({
					name: z.string(),
				}),
			},
			async (c) => {
				return c.body;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post", {
			body: JSON.stringify({
				name: "hello",
			}),
			method: "POST",
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ name: "hello" });
	});

	it("should work with request with a query param", async () => {
		const endpoint = createEndpoint(
			"/post",
			{
				method: "POST",
				query: z.object({
					name: z.string(),
				}),
			},
			async (c) => {
				return c.query;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post?name=hello", {
			method: "POST",
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ name: "hello" });
	});

	it("should work with request with dynamic param", async () => {
		const endpoint = createEndpoint(
			"/post/:id",
			{
				method: "POST",
			},
			async (c) => {
				return c.params;
			},
		);
		const router = createRouter({
			endpoint,
		});
		const request = new Request("http://localhost/post/1", {
			method: "POST",
		});
		const response = await router.handler(request).then((res) => res.json());
		expect(response).toMatchObject({ id: "1" });
	});
});

describe("route middleware", () => {
	it("should apply middleware as context", async () => {
		const endpoint = createEndpoint(
			"/",
			{
				method: "GET",
			},
			async (c) => {
				const cx = c.json({ name: "hello" });
				console.log(cx);
				return cx;
			},
		);
		const router = createRouter({ endpoint });
		const response = await router.handler(new Request("http://localhost"));
		const json = await response.json();
		expect(json).toMatchObject({ name: "hello" });
	});
});
