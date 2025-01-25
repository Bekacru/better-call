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
	async () => {
		return "hello from better-call!";
	},
);

const router = createRouter({ hello });

Bun.serve({
	fetch: router.handler,
});
