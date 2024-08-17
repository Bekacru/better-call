# better-call

Better call is a tiny web framework for creating endpoints that can be invoked as a normal function or mounted to a router to be served by any web standard compatible server (like Bun, node, nextjs, sveltekit...) and also includes a typed RPC client for typesafe client-side invocation of these endpoints.

Built for typescript and it comes with a very high performance router based on [rou3](https://github.com/unjs/rou3).

> ⚠️ This project in development and not ready for production use. But feel free to try it out and give feedback.

## Install

```bash
pnpm i better-call
```

make sure to install zod if you haven't

```bash
pnpm i zod
```

## Usage

The building blocks for better-call are endpoints. You can create an endpoint by calling `createEndpoint` and passing it a path, [options](#endpointoptions) and a handler that will be invoked when the endpoint is called.

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
const router = createRouter({
    createItem
})

Bun.serve({
    fetch: router.handler
})
```

Then you can use the rpc client to call the endpoints on client.

```ts
//client.ts
import { createClient } from "better-call/client";

const client = createClient<typeof router>();
const items = await client("/item", {
    body: {
        id: "123"
    }
});
```

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

### Endpoint

Endpoints are building blocks of better-call. 

#### Path

The path is the URL path that the endpoint will respond to. It can be a direct path or a path with parameters and wildcards.

```ts
//direct path
const endpoint = createEndpoint("/item", {
    method: "GET",
}, async (ctx) => {})

//path with parameters
const endpoint = createEndpoint("/item/:id", {
    method: "GET",
}, async (ctx) => {
    return {
        item: {
            id: ctx.params.id
        }
    }
})

//path with wildcards
const endpoint = createEndpoint("/item/**:name", {
    method: "GET",  
}, async (ctx) => {
    //the name will be the remaining path
    ctx.params.name
})
```
#### Body Schema

The `body` option accepts a zod schema and will validate the request body. If the request body doesn't match the schema, the endpoint will throw an error. If it's mounted to a router, it'll return a 400 error.

```ts
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
```

#### Query Schema

The `query` option accepts a zod schema and will validate the request query. If the request query doesn't match the schema, the endpoint will throw an error. If it's mounted to a router, it'll return a 400 error.

```ts
const createItem = createEndpoint("/item", {
    method: "GET",
    query: z.object({
        id: z.string()
    })
}, async (ctx) => {
    return {
        item: {
            id: ctx.query.id
        }
    }
})
```

#### Require Headers

The `requireHeaders` option is used to require the request to have headers. If the request doesn't have headers, the endpoint will throw an error. And even when you call the endpoint as a function, it will require headers to be passed in the context.

```ts
const createItem = createEndpoint("/item", {
    method: "GET",
    requireHeaders: true
}, async (ctx) => {
    return {
        item: {
            id: ctx.headers.get("id")
        }
    }
})
createItem({
    headers: new Headers()
})
```

#### Require Request

The `requireRequest` option is used to require the request to have a request object. If the request doesn't have a request object, the endpoint will throw an error. And even when you call the endpoint as a function, it will require a request to be passed in the context.

```ts
const createItem = createEndpoint("/item", {
    method: "GET",
    requireRequest: true
}, async (ctx) => {
    return {
        item: {
            id: ctx.request.id
        }
    }
})

createItem({
    request: new Request()
})
```


### Handler

this is the function that will be invoked when the endpoint is called. It accepts a context object that contains the request, headers, body, query, params and other information. 

It can return a response object, a string, a boolean, a number, an object with a status, body, headers and other properties or undefined.

If you return a response object, it will be returned as is even when it's mounted to a router.

It can also throw an error and if it throws APIError, it will be converted to a response object with the correct status code and headers.

- **Context**: the context object contains the request, headers, body, query, params and a helper function to set headers, cookies and get cookies. If there is a middleware, the context will be extended with the middleware context.

### Middleware

Endpoints can use middleware by passing the `use` option to the endpoint. To create a middleware, you can call `createMiddleware` and pass it a function or an options object and a handler function.

If you return a context object from the middleware, it will be available in the endpoint context.

```ts
const middleware = createMiddleware(async (ctx) => {
    return {
        name: "hello"
    }
})
const endpoint = createEndpoint("/", {
    method: "GET",
    use: [middleware],
}, async (ctx) => {
   //this will be the context object returned by the middleware with the name property
   ctx.context
})
```

You can also pass an options object to the middleware and a handler function.

```ts
const middleware = createMiddleware({
    body: z.object({
        name: z.string()
    })
}, async (ctx) => {
    return {
        name: "hello"
    }
})

const endpoint = createEndpoint("/", {
    method: "GET",
    use: [middleware],  
}, async (ctx) => {
    //the body will also contain the middleware body
    ctx.body
})
```

### Router

You can create a router by calling `createRouter` and passing it an array of endpoints. It returns a router object that has a `handler` method that can be used to serve the endpoints.

```ts
import { createRouter } from "better-call"
import { createItem } from "./item"

const router = createRouter({
    createItem
})

Bun.serve({
    fetch: router.handler
})
```

Behind the scenes, the router uses [rou3](https://github.com/unjs/rou3) to match the endpoints and invoke the correct endpoint. You can look at the [rou3 documentation](https://github.com/unjs/rou3) for more information.

#### Router Options

**routerMiddleware:**

A router middleware is similar to an endpoint middleware but it's applied to any path that matches the route. It's like any traditional middleware. You have to pass endpoints to the router middleware as an array.

```ts
const routeMiddleware = createEndpoint("/api/**", {
    method: "GET",
}, async (ctx) => {
    return {
        name: "hello"
    }
})
const router = createRouter({
    createItem
}, {
    routerMiddleware: [{
        path: "/api/**",
        middleware:routeMiddleware
    }]
})
```

**basePath**: The base path for the router. All paths will be relative to this path.

**onError**: The router will call this function if an error occurs in the middleware or the endpoint.

**throwError**: If true, the router will throw an error if an error occurs in the middleware or the endpoint.

### RPC Client

better-call comes with a rpc client that can be used to call endpoints from the client. The client wraps over better-fetch so you can pass any options that are supported by better-fetch.

```ts
import { createClient } from "better-call/client";
import { router } from "@serve/router";

const client = createClient<typeof router>({
    /**
     * if you add custom path like `http://
     * localhost:3000/api` make sure to add the 
     * custom path on the router config as well.
    */
    baseURL: "http://localhost:3000"
});
const items = await client("/item", {
    body: {
        id: "123"
    }
});
```
> You can also pass object that contains endpoints as a generic type to create client.

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

> other than normal cookies the ctx object also exposes signed cookies.

## License
MIT