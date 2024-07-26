import type { Endpoint } from "./endpoint";
import {
    createRouter as createRou3Router,
    addRoute,
    findRoute,
} from "rou3";
import { getBody, shouldSerialize, statusCode } from "./utils";
import { APIError } from "./better-call-error";

interface RouterConfig {
    /**
     * Throw error if error occurred other than APIError
     */
    throwError?: boolean
    /**
     * Handle error
     */
    onError?: (e: unknown) => void | Promise<void> | Response | Promise<Response>
}

export const createRouter = <E extends Endpoint, Config extends RouterConfig>(endpoints: E[], config?: Config) => {
    const router = createRou3Router()
    for (const endpoint of endpoints) {
        if (Array.isArray(endpoint.options?.method)) {
            for (const method of endpoint.options.method) {
                addRoute(router, method, endpoint.path, endpoint)
            }
        } else {
            addRoute(router, endpoint.options.method, endpoint.path, endpoint)
        }
    }

    const handler = async (request: Request) => {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const route = findRoute(router, method, path)
        const handler = route?.data as Endpoint
        const body = await getBody(request)
        const responseHeaders = new Headers()
        const headers = request.headers

        //handler 404
        if (!handler) {
            return new Response(null, {
                status: 404,
                statusText: "Not Found"
            })
        }
        try {
            let middleware: Record<string, any> = {}
            if (handler.middleware) {
                middleware = await handler.middleware({
                    path: path,
                    method: method,
                    headers,
                    params: url.searchParams,
                    request: request.clone(),
                    body: body,
                })
            }
            const handlerRes = await handler({
                path: path,
                method: method as "GET",
                headers,
                params: route?.params as any,
                request: request,
                body: body,
                ...middleware,
            })
            if (handlerRes instanceof Response) {
                return handlerRes
            }
            const resBody = shouldSerialize(handlerRes) ? JSON.stringify(handlerRes) : handlerRes
            return new Response(resBody as any, {
                headers: handler.headers
            })
        } catch (e) {
            if (config?.onError) {
                const onErrorRes = await config.onError(e)
                if (onErrorRes instanceof Response) {
                    return onErrorRes
                }
            }
            if (e instanceof APIError) {
                return new Response(e.body ? JSON.stringify(e.body) : null, {
                    status: statusCode[e.status],
                    statusText: e.status,
                    headers: {
                        "Content-Type": "application/json",
                    }
                })
            }
            if (config?.throwError) {
                throw e
            }
            return new Response(null, {
                status: 500,
                statusText: "Internal Server Error"
            })
        }
    }
    return { handler }
}