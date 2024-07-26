import { z, ZodError, type ZodOptional, type ZodSchema } from "zod"
import type { Middleware } from "./middleware"
import { APIError } from "./better-call-error";


export type RequiredKeysOf<BaseType extends object> = Exclude<{
    [Key in keyof BaseType]: BaseType extends Record<Key, BaseType[Key]>
    ? Key
    : never
}[keyof BaseType], undefined>;

export type HasRequiredKeys<BaseType extends object> = RequiredKeysOf<BaseType> extends never ? false : true;

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "*"

export interface EndpointOptions {
    method: Method | Method[]
    body?: ZodSchema
    query?: ZodSchema
    params?: ZodSchema<any>
    /**
     * If true headers will be required to be passed in the context
     */
    requireHeaders?: boolean
    /**
     * If true request object will be required
     */
    requireRequest?: boolean
}

type InferParamPath<Path> =
    Path extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof InferParamPath<Rest>]: string }
    : Path extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : Path extends `${infer _Start}/${infer Rest}`
    ? InferParamPath<Rest>
    : undefined;

type InferParamWildCard<Path> = Path extends `${infer _Start}/*:${infer Param}/${infer Rest}` | `${infer _Start}/**:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof InferParamPath<Rest>]: string }
    : Path extends `${infer _Start}/*`
    ? { [K in "_"]: string }
    : Path extends `${infer _Start}/${infer Rest}`
    ? InferParamPath<Rest>
    : undefined;


export type Prettify<T> = {
    [key in keyof T]: T[key];
} & {};

type ContextTools = {
    setHeader: (key: string, value: string) => void
    setCookie: (key: string, value: string) => void
    getCookie: (key: string) => string | undefined
}

export type Context<Path extends string, Opts extends EndpointOptions, Extra extends Record<string, any> = {}> = InferBody<Opts["body"]> & InferParam<Path> & InferMethod<Opts['method']> & InferHeaders<Opts["requireHeaders"]> & InferRequest<Opts["requireRequest"]> & InferQuery<Opts["query"]> & Extra

type InferMethod<M extends Method | Method[]> = M extends Array<Method> ? {
    method: M[number]
} : {
    method?: M
}

type InferHeaders<HeaderReq> = HeaderReq extends true ? {
    headers: Headers
} : {
    headers?: Headers
}

type InferRequest<RequestReq> = RequestReq extends true ? {
    request: Request
} : {
    request?: Request
}


type InferBody<Body> = Body extends ZodSchema ? Body extends ZodOptional<any> ? {
    body?: z.infer<Body>
} : {
    body: z.infer<Body>
} : {
    body?: undefined
}

type InferQuery<Query> = Query extends ZodSchema ? Query extends ZodOptional<any> ? {
    query?: z.infer<Query>
} : {
    query: z.infer<Query>
} : {
    query?: undefined
}

type InferParam<Path extends string, ParamPath extends InferParamPath<Path> = InferParamPath<Path>, WildCard extends InferParamWildCard<Path> = InferParamWildCard<Path>> = ParamPath extends undefined ? WildCard extends undefined ? {
    params?: undefined
} : {
    params: WildCard
} : {
    params: ParamPath & (WildCard extends undefined ? {} : WildCard)
}


export type EndpointResponse = Record<string, any> | string | boolean | number | {
    status: string,
    body: any,
    headers: Headers | Record<string, any>
    [key: string]: any
} | void | undefined

export type Handler<Path extends string, Opts extends EndpointOptions, R extends EndpointResponse, Extra extends Record<string, any> = Record<string, any>> = (ctx: Context<Path, Opts, Extra>) => Promise<R>

export interface EndpointConfig {
    /**
     * Throw when the response isn't in 200 range
     */
    throwOnError?: boolean
}

export function createEndpoint<Path extends string, Opts extends EndpointOptions, R extends EndpointResponse>(path: Path, options: Opts, handler: Handler<Path, Opts, R, ContextTools>) {
    const responseHeader = new Headers()
    type Ctx = Context<Path, Opts>
    const handle = async (...ctx: HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]) => {
        const internalCtx = ({
            setHeader(key, value) {
                responseHeader.set(key, value)
            },
            setCookie(key, value) {
                responseHeader.append("Set-Cookie", `${key}=${value}`)
            },
            getCookie(key) {
                const header = ctx[0]?.headers
                return header?.get("cookie")?.split(";").find(cookie => cookie.startsWith(`${key}=`))?.split("=")[1]
            },
            ...(ctx[0] || {})
        }) as (Ctx & ContextTools)
        try {
            internalCtx.body = options.body ? options.body.parse(internalCtx.body) : undefined
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
        const res = await handler(internalCtx)
        return res as ReturnType<Handler<Path, Opts, R>>
    }
    handle.path = path
    handle.options = options
    handle.method = options.method
    handle.headers = responseHeader
    //for type inference
    handle.middleware = undefined as (Middleware<any> | undefined)

    return handle
}

export type Endpoint = {
    path: string
    options: EndpointOptions
    middleware?: Middleware<any>
    headers?: Headers
} & ((ctx: any) => Promise<any>)