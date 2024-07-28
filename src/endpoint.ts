import { z, ZodError, type ZodOptional, type ZodSchema } from "zod"
import type { Middleware } from "./middleware"
import { APIError } from "./better-call-error";
import type { HasRequiredKeys, UnionToIntersection } from "./helper";
import type { Context, ContextTools, Endpoint, EndpointOptions, EndpointResponse, Handler } from "./types";


export interface EndpointConfig {
    /**
     * Throw when the response isn't in 200 range
     */
    throwOnError?: boolean
}

export function createEndpoint<Path extends string, Opts extends EndpointOptions, R extends EndpointResponse>(path: Path, options: Opts, handler: Handler<Path, Opts, R>) {
    const responseHeader = new Headers()
    type Ctx = Context<Path, Opts>
    const handle = async (...ctx: HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]) => {
        let internalCtx = ({
            setHeader(key: string, value: string) {
                responseHeader.set(key, value)
            },
            setCookie(key: string, value: string) {
                responseHeader.append("Set-Cookie", `${key}=${value}`)
            },
            getCookie(key: string) {
                const header = ctx[0]?.headers
                return header?.get("cookie")?.split(";").find(cookie => cookie.startsWith(`${key}=`))?.split("=")[1]
            },
            ...(ctx[0] || {}),
            context: {}
        })
        if (options.use?.length) {
            for (const middleware of options.use) {
                const res = await middleware(internalCtx) as Endpoint
                const body = res.options?.body ? res.options.body.parse(internalCtx.body) : undefined
                if (res) {
                    internalCtx = {
                        ...internalCtx,
                        body: body ? {
                            ...body,
                            ...internalCtx.body
                        } : internalCtx.body,
                        context: {
                            ...internalCtx.context || {},
                            ...res
                        }
                    }
                }
            }
        }
        try {
            const body = options.body ? options.body.parse(internalCtx.body) : undefined
            internalCtx = {
                ...internalCtx,
                body: body ? {
                    ...body,
                    ...internalCtx.body
                } : internalCtx.body,
            }
            internalCtx.query = options.query ? options.query.parse(internalCtx.query) : undefined
            internalCtx.params = options.params ? options.params.parse(internalCtx.params) : undefined
        } catch (e) {
            if (e instanceof ZodError) {
                throw new APIError("Bad Request", {
                    message: e.message,
                    details: e.errors
                })
            }
            throw e
        }
        if (options.requireHeaders && !internalCtx.headers) {
            throw new APIError("Bad Request", {
                message: "Headers are required"
            })
        }
        if (options.requireRequest && !internalCtx.request) {
            throw new APIError("Bad Request", {
                message: "Request is required"
            })
        }
        //@ts-expect-error
        const res = await handler(internalCtx)
        return res as ReturnType<Handler<Path, Opts, R>>
    }
    handle.path = path
    handle.options = options
    handle.method = options.method
    handle.headers = responseHeader
    return handle
}