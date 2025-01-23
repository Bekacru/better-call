import { describe, expectTypeOf, it } from "vitest";
import { createMiddleware } from "./middleware";
import { createEndpoint } from "./endpoint";
import { z } from "zod";

describe("middleware type", () => {
	it("should infer middleware returned type", async () => {
		const middleware = createMiddleware(async (c) => {
			return 1;
		});
		const middleware2 = createMiddleware(async (c) => {
			return {
				hello: "world",
			};
		});
		createEndpoint(
			"/",
			{
				method: "POST",
				use: [middleware, middleware2],
			},
			async (c) => {
				expectTypeOf(c.context).toMatchTypeOf<
					{
						hello: string;
					} & number
				>();
			},
		);
	});
});
