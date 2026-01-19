import { describe, expectTypeOf, it } from "vitest";
import type * as z from "zod";
import type { InferParam, InferParamInput } from "./context";
import type { EndpointOptions } from "./endpoint";
import type { InferParamPath, InferParamWildCard } from "./helper";

describe("infer param", () => {
	it("empty path", () => {
		expectTypeOf<InferParamPath<"/">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParamWildCard<"/">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParam<"/">>().toEqualTypeOf<Record<string, any> | undefined>();
		expectTypeOf<InferParam<never>>().toEqualTypeOf<Record<string, any> | undefined>();
	});
	it("static path", () => {
		expectTypeOf<InferParamPath<"/static/path">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParamWildCard<"/static/path">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParam<"/static/path">>().toEqualTypeOf<Record<string, any> | undefined>();
	});
	it("single param", () => {
		expectTypeOf<InferParamPath<"/user/:id">>().toEqualTypeOf<{ id: string }>();
		expectTypeOf<InferParamWildCard<"/user/:id">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParam<"/user/:id">>().toEqualTypeOf<{ id: string }>();
	});
	it("multiple params", () => {
		expectTypeOf<InferParamPath<"/user/:userId/post/:postId">>().toEqualTypeOf<{
			userId: string;
			postId: string;
		}>();
		expectTypeOf<InferParamWildCard<"/user/:userId/post/:postId">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParam<"/user/:userId/post/:postId">>().toEqualTypeOf<{
			userId: string;
			postId: string;
		}>();
	});
	it("wildcard param", () => {
		expectTypeOf<InferParamPath<"/files/*">>().toEqualTypeOf<{}>();
		expectTypeOf<InferParamWildCard<"/files/*">>().toEqualTypeOf<{ _: string }>();
		expectTypeOf<InferParam<"/files/*">>().toEqualTypeOf<{ _: string }>();
	});
	it("mixed params", () => {
		expectTypeOf<InferParamPath<"/user/:userId/files/*">>().toEqualTypeOf<{ userId: string }>();
		expectTypeOf<InferParamWildCard<"/user/:userId/files/*">>().toEqualTypeOf<{ _: string }>();
		expectTypeOf<InferParam<"/user/:userId/files/*">>().toEqualTypeOf<{
			userId: string;
			_: string;
		}>();
	});
});

describe("infer param with schema", () => {
	it("single param with schema", () => {
		type Options = EndpointOptions & {
			params: z.ZodObject<{ id: z.ZodString }>;
		};
		expectTypeOf<InferParam<"/user/:id", Options>>().toEqualTypeOf<{
			id: string;
		}>();
	});

	it("optional param with schema", () => {
		type Options = EndpointOptions & {
			params: z.ZodObject<{ id: z.ZodOptional<z.ZodString> }>;
		};
		expectTypeOf<InferParam<"/user/:id", Options>>().toEqualTypeOf<{
			id?: string;
		}>();
	});

	it("fallback to path inference when no schema", () => {
		type Options = EndpointOptions & {
			params?: undefined;
		};
		expectTypeOf<InferParam<"/user/:id", Options>>().toEqualTypeOf<{
			id: string;
		}>();
	});

	it("input type with optional param", () => {
		type Options = EndpointOptions & {
			params: z.ZodObject<{ id: z.ZodOptional<z.ZodString> }>;
		};
		expectTypeOf<InferParamInput<"/user/:id", Options>>().toEqualTypeOf<{
			params: { id?: string };
		}>();
	});

	it("input type with required param", () => {
		type Options = EndpointOptions & {
			params: z.ZodObject<{ id: z.ZodString }>;
		};
		expectTypeOf<InferParamInput<"/user/:id", Options>>().toEqualTypeOf<{
			params: { id: string };
		}>();
	});
});
