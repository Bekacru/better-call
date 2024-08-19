import { IncomingMessage, ServerResponse } from "node:http";

import { getRequest, setResponse } from "./request.js";
import type { Router } from "../router.js";

export function toNodeHandler(router: Router) {
	return async (req: IncomingMessage, res: ServerResponse) => {
		const protocol = (req.connection as any)?.encrypted ? "https" : "http";

		const base = `${protocol}://${req.headers[":authority"] || req.headers.host}`;

		const response = await router.handler(getRequest({ base, request: req }));

		setResponse(res, response);
	};
}

export { getRequest, setResponse };
