import { createClient } from "@better-call/client";
import { createEndpoint, createRouter } from "@better-call/core";

const router = createRouter({
	test: createEndpoint("/test", { method: "POST" }, async () => "test"),
} as const);

type Router = typeof router;

const client = createClient<Router>({ baseURL: "http://localhost:3000" });

const res = client.useQuery(["test"], "@post/test");
