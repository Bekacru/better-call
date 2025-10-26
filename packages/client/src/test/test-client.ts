import type { Router } from "@better-call/core";
import { createEndpoint, createRouter } from "@better-call/core";
import type { FetchEsque } from "@better-fetch/fetch";
import { createClient, type ClientOptions } from "../client";
import { it, vi, type Mock } from "vitest";
import z from "zod/v4";

export const defaultRouter = createRouter({
	read: createEndpoint(
		"/read",
		{
			method: "GET",
			query: z.object({
				id: z.string(),
			}),
		},
		async (ctx) => {
			return ctx.query.id;
		},
	),
	write: createEndpoint(
		"/write",
		{
			method: "POST",
			body: z.object({
				msg: z.string(),
			}),
		},
		async (ctx) => {
			return ctx.body.msg;
		},
	),
});

export const clientTest = <R extends Router = typeof defaultRouter>(
	router_?: R,
	options?: ClientOptions,
) => {
	const router = (router_ ?? defaultRouter) as R;

	return it.extend({
		customFetchImpl: async (
			{},
			use: (value: Mock<FetchEsque>) => Promise<void>,
		) => {
			const customFetchImpl = vi.fn((async (url, init) => {
				return router.handler(new Request(url, init));
			}) satisfies FetchEsque);
			await use(customFetchImpl);
			customFetchImpl.mockClear();
		},
		client: async (
			{ customFetchImpl }: any,
			use: (value: ReturnType<typeof createClient<R>>) => Promise<void>,
		) => {
			const client = createClient<R>({
				baseURL: "http://localhost:3000",
				customFetchImpl,
				...options,
			});

			await use(client);
		},
		endpoints: async ({}, use: (value: R["endpoints"]) => Promise<void>) => {
			await use(router.endpoints);
		},
	} as const);
};
