import type { HasRequiredKeys } from "type-fest"
import { type Context, type EndpointOptions, type EndpointResponse, type Handler } from "./endpoint"


export type Middleware<E extends Record<string, string>> = (ctx: Context<string, EndpointOptions, E>) => Promise<E | void>

export const createMiddleware = <E extends Record<string, any>, M extends Middleware<E>>(middleware: M) => {
    type MiddlewareReturn = Awaited<ReturnType<M>>
    type MiddlewareContext = MiddlewareReturn extends void ? {} : MiddlewareReturn
    return <Path extends string, Opts extends EndpointOptions, R extends EndpointResponse>(path: Path, options: Opts, handler: Handler<Path, Opts, R, MiddlewareContext>) => {
        type Ctx = Context<Path, Opts, MiddlewareContext>
        const handle = async (...ctx: HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]) => {
            const res = await handler((ctx[0] || {}) as Ctx)
            return res as ReturnType<Handler<Path, Opts, R>>
        }
        handle.path = path
        handle.options = options
        handle.middleware = middleware
        return handle
    }
} 