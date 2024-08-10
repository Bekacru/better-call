import { z, ZodError, type ZodOptional, type ZodSchema } from "zod"
import { createMiddleware, type Middleware } from "./middleware"
import { APIError } from "./better-call-error";
import type { HasRequiredKeys, UnionToIntersection } from "./helper";
import type { Context, ContextTools, CookieOptions, Endpoint, EndpointOptions, EndpointResponse, Handler } from "./types";


export interface EndpointConfig {
    /**
     * Throw when the response isn't in 200 range
     */
    throwOnError?: boolean
}

export function createEndpointCreator<T extends Record<string, any>>() {
    return <Path extends string, Opts extends EndpointOptions, R extends EndpointResponse>(path: Path, options: Opts, handler: Handler<Path, Opts, R, T>) => {
        //@ts-expect-error
        return createEndpoint(path, options, handler)
    }

}

export function createEndpoint<Path extends string, Opts extends EndpointOptions, R extends EndpointResponse>(path: Path, options: Opts, handler: Handler<Path, Opts, R>) {
    const responseHeader = new Headers()
    type Ctx = Context<Path, Opts>
    const handle = async (...ctx: HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]) => {
        let internalCtx = ({
            setHeader(key: string, value: string) {
                responseHeader.set(key, value)
            },
            setCookie(key: string, value: string, options?: CookieOptions) {
                const cookieOptions = options || {}
                responseHeader.append("Set-Cookie", `${key}=${value}; Max-Age=${cookieOptions.maxAge || 0}; Domain=${cookieOptions.domain || ""}; Path=${cookieOptions.path || "/"}; Secure=${cookieOptions.secure || false}; HttpOnly=${cookieOptions.httpOnly || false}`)
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
            const body = options.body ? options.body.parse(internalCtx.body) : internalCtx.body
            internalCtx = {
                ...internalCtx,
                body: body ? {
                    ...body,
                    ...internalCtx.body
                } : internalCtx.body,
            }
            internalCtx.query = options.query ? options.query.parse(internalCtx.query) : internalCtx.query
            internalCtx.params = options.params ? options.params.parse(internalCtx.params) : internalCtx.params
        } catch (e) {
            if (e instanceof ZodError) {
                throw new APIError("BAD_REQUEST", {
                    message: e.message,
                    details: e.errors
                })
            }
            throw e
        }
        if (options.requireHeaders && !internalCtx.headers) {
            throw new APIError("BAD_REQUEST", {
                message: "Headers are required"
            })
        }
        if (options.requireRequest && !internalCtx.request) {
            throw new APIError("BAD_REQUEST", {
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