import { createClientFactory } from "@better-call/client";
import { useStore } from "./use-store";

export const createClient = createClientFactory({
	useStore,
});
