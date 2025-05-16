import type { IncomingMessage, ServerResponse } from "node:http";

import { getRequest, setResponse } from "./request";
import type { Router } from "../../router.js";

export function toNodeHandler(handler: Router["handler"]) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    // src/adapters/node/index.ts
    const forwarded = req.headers["x-forwarded-proto"];
    // FIXME: THERE IS A CASE WHERE FORWARDED IS AN ARRAY,
    // IF IT'S AN ARRAY I CHECK FOR HTTPS
    // IF NOT I DEFAULT TO HTTP
    const protocol = forwarded
      ? Array.isArray(forwarded)
        ? forwarded.includes("https")
          ? "https"
          : "http"
        : forwarded.split(",")[0].trim() // The header can also be a string with coma so I just split it manually
      : (req.socket as any).encrypted
        ? "https"
        : "http";

    const base = `${protocol}://${
      req.headers[":authority"] || req.headers.host
    }`;
    const response = await handler(getRequest({ base, request: req }));
    return setResponse(res, response);
  };
}

export { getRequest, setResponse };
