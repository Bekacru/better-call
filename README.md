# better-call

Better call is a tiny web framework for creating endpoints that can be invoked as a normal function or mounted to a router and can be served by any web standard compatible server (like Bun, node, nextjs, sveltekit...). 

Built for typescript and it comes with a very high performance router based on [rou3](https://github.com/unjs/rou3).


> ⚠️ This project early in development and not ready for production use. But feel free to try it out and give feedback.

## Install

```bash
pnpm i better-call
```

## Usage

The building blocks for better-call are endpoints. You can create an endpoint by calling `createEndpoint` and passing it a path, inputs that can be validated with zod (body, query) and a function that will be invoked when the endpoint is called.

```ts
import { createEndpoint, createRouter } from "better-call"
import { z } from "zod"

const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    return {
        item: {
            id: ctx.body.id
        }
    }
})

// Now you can call the endpoint just as a normal function.
const item = await createItem({
    body: {
        id: "123"
    }
})
```

OR you can mount the endpoint to a router and serve it with any web standard compatible server. 

> The example below uses [Bun](https://bun.sh/)

```ts
const router = createRouter([
    createItem
])

Bun.serve({
    fetch: router.handler
})
```

### Middleware

You can create middleware by calling `createMiddleware` and passing it a function that will be invoked before the endpoint is called.

If you return a context object from the middleware, it will be merged with the context object on the endpoint.

```ts
import { createMiddleware, createEndpoint } from "better-call"

const createProtectedEndpoint = createMiddleware(async (ctx) => {
    if(ctx.headers.get("Authorization") !== "Bearer 123") {
        throw new Error("Unauthorized")
    }
    return {
       context: {
            session: {
                id: "123",
            }
       }
    }
})

const getUser = createProtectedEndpoint("/:id", {
    method: "GET"
},
async (ctx) => {
    const user = await getUserFromDatabase(ctx.params.id)
    // ctx.session is the session object
    return {
        user: ctx.session.user
    }
})
```

### Router

You can create a router by calling `createRouter` and passing it an array of endpoints. It returns a router object that has a `handler` method that can be used to serve the endpoints.

```ts
import { createRouter } from "better-call"
import { createItem } from "./item"

const router = createRouter([
    createItem
])
```
Behind the scenes, the router uses [rou3](https://github.com/unjs/rou3) to match the endpoints and invoke the correct endpoint. You can look at the [rou3 documentation](https://github.com/unjs/rou3) for more information.


### Returning non 200 responses

To return a non 200 response, you will need to throw Better Call's `APIError` error. If the endpoint is called as a function, the error will be thrown but if it's mounted to a router, the error will be converted to a response object with the correct status code and headers.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    if(ctx.body.id === "123") {
        throw new APIError("Bad Request", {
            message: "Id is not allowed"
        })
    }
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

### Headers and Cookies

If you return a response object from an endpoint, the headers and cookies will be set on the response object. But You can  set headers and cookies for the context object.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    ctx.setHeader("X-Custom-Header", "Hello World")
    ctx.setCookie("my-cookie", "hello world")
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```
 
You can also get cookies from the context object.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    const cookie = ctx.getCookie("my-cookie")
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

## API

### `createEndpoint`

```ts
createEndpoint(path: string, options: EndpointOptions, fn: EndpointFunction): Endpoint
```

Creates an endpoint. The `path` is the path that will be used to match the endpoint. The `options` are the options that will be used to validate the request. The `fn` is the function that will be invoked when the endpoint is called.

### `path`

The path defines how the framework matches requests to endpoints. It can include parameters and wildcards that are extracted from the request and passed to the endpoint function.

1. **Path Parameters**: 
   - Use `:` to define a parameter in the path. For example, `/item/:id` will extract the `id` from the request URL and pass it to the endpoint function as part of the `params` object.
     - Example: For a request to `/item/123`, the endpoint function will receive `{ id: '123' }`.

2. **Wildcards**:
   - Use `*` or `**` to match any part of the path. When using a wildcard, the remaining path will be captured in the `params` object under the `_` property.
     - Example: For a path `/item/*`, a request to `/item/abc/def` will pass `{ _: 'abc/def' }` to the endpoint function.

3. **Named Wildcards**:
   - To capture the remaining path with a specific name, use `*:` followed by the desired name. The remaining path will be assigned to this named property.
     - Example: For a path `/item/*:name`, a request to `/item/abc/def` will pass `{ name: 'abc/def' }` to the endpoint function.


### `EndpointOptions`

```ts
type EndpointOptions = {
    method?: METHOD | METHOD[]
    body?: ZodSchema
    query?: ZodSchema
    params?: ZodSchema
    requireHeaders?: boolean
    requireRequest?: boolean
}
```

- **method**: the endpoint options accept method which can be a method or an array of methods. If you pass an array of methods, the endpoint will match if the request method is one of the methods in the array. And method will be required when calling the endpoint even as a function.

- **body**: the body option accepts a zod schema and will validate the request body. If the request body doesn't match the schema, the endpoint will throw an error. If it's mounted to a router, it'll return a 400 error.

- **query**: the query option accepts a zod schema and will validate the request query. If the request query doesn't match the schema, the endpoint will throw an error. If it's mounted to a router, it'll return a 400 error.

- **params**: the params option accepts a zod schema and will validate the request params. The params are defined in the path and will be extracted from the request.

- **requireHeaders**: if true, the endpoint will throw an error if the request doesn't have headers. And even when you call the endpoint as a function, it will require headers to be passed in the context.

- **requireRequest**: if true, the endpoint will throw an error if the request doesn't have a request object. And even when you call the endpoint as a function, it will require a request to be passed in the context.


### `EndpointFunction`

this is the function that will be invoked when the endpoint is called. It accepts a context object that contains the request, headers, body, query, params and other information. 

It can return a response object, a string, a boolean, a number, an object with a status, body, headers and other properties or undefined.

If you return a response object, it will be returned as is even when it's mounted to a router.


- **Context**: the context object contains the request, headers, body, query, params and a helper function to set headers, cookies and get cookies. If there is a middleware, the context will be extended with the middleware context.




## License
MIT