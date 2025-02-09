import { createEndpoint } from "../src/endpoint";
import { createRouter } from "../src/router";

const hello = createEndpoint(
	"/hello",
	{
		method: "GET",
		metadata: {
			openAPI: {
				responses: {
					"200": {
						description: "Welcome Page",
						content: {
							"text/plain": {
								schema: {
									type: "string",
								},
							},
						},
					},
				},
			},
		},
	},
	async (c) => {
		c.setCookie("hello", "world");
		c.setCookie("test", "value");
		return "hello from better-call!";
	},
);

const router = createRouter({ hello });

Bun.serve({
	fetch: router.handler,
});
