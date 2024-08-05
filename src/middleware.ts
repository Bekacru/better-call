import { z } from "zod"
import type { ContextTools, Endpoint, EndpointOptions, EndpointResponse, Handler, InferBody, InferHeaders, InferRequest, Prettify } from "./types"
import { createEndpoint } from "./endpoint"

export type MiddlewareHandler<Opts extends EndpointOptions, R extends EndpointResponse> = (ctx: Prettify<InferBody<Opts> & InferRequest<Opts> & InferHeaders<Opts> & {
    params?: Record<string, string>,
    query?: Record<string, string>,
} & ContextTools>) => Promise<R>

export function createMiddleware<Opts extends EndpointOptions, R extends EndpointResponse>(optionsOrHandler: MiddlewareHandler<Opts, R>): Endpoint<Handler<string, Opts, R>, Opts>
export function createMiddleware<Opts extends Omit<EndpointOptions, "method">, R extends EndpointResponse>(optionsOrHandler: Opts, handler: MiddlewareHandler<Opts & {
    method: "*"
}, R>): Endpoint<Handler<string, Opts & {
    method: "*"
}, R>, Opts & {
    method: "*"
}>
export function createMiddleware(optionsOrHandler: any, handler?: any) {
    if (typeof optionsOrHandler === "function") {
        return createEndpoint("*", {
            method: "*"
        }, optionsOrHandler)
    }
    if (!handler) {
        throw new Error("Middleware handler is required")
    }
    const endpoint = createEndpoint("*", {
        ...optionsOrHandler,
        method: "*"
    }, handler)
    return endpoint as any
}

export type Middleware<Opts extends EndpointOptions = EndpointOptions, R extends EndpointResponse = EndpointResponse> = (opts: Opts, handler: (ctx: {
    body?: InferBody<Opts>,
    params?: Record<string, string>,
    query?: Record<string, string>
}) => Promise<R>) => Endpoint