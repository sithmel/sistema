# Sistema

Sistema is a lightweight dependency injection library for node.js. It makes possible to write fast, testable and reliable applications.

## Dependency

The core concept of sistema is the dependency:

```js
const { Dependency } = require("sistema")
const { Client } = require("pg")

const dbConnection = new Dependency().provides(async () => {
  const client = new Client()
  // Connect to the PostgreSQL database
  return client.connect()
})
```

A dependency runs a function and provides a value (optionally wrapped in a promise).

A dependency can depend on other dependencies (just one in the example but they can be multiple!):

```js
const usersQuery = new Dependency()
  .dependsOn(dbConnection)
  .provides(async (client) => {
    const result = await client.query("SELECT * FROM users")
    return result.rows
  })
```

A dependency is executed with the **run** method:

```js
usersQuery.run().then((rows) => {
  rows.forEach((row) => console.log(row))
})
```

The output of run is always a promise.

## Parameters

A dependency can take parameters, these are expressed as strings:

```js
const userQuery = new Dependency()
  .dependsOn(dbConnection, "userId")
  .provides(async (client, userId) => {
    const result = await client.query("SELECT * FROM users WHERE ID = $1", [
      userId,
    ])
    return result.rows[0]
  })
```

and must be passed as objects in the run method.

```js
await userQuery.run({ userId: 12345 })
```

## ResourceDependencies and context

In the previous example we open a database connection every time we need a dbConnection. Some dependencies are better to be created once and then reused. And in the case of a database connection we also have to close the connection:

```js
const { ResourceDependency } = require("sistema")
const { Client } = require("pg")

let client

const dbConnection = new ResourceDependency()
  .provides(async () => {
    client = new Client()
    // Connect to the PostgreSQL database
    return client.connect()
  })
  .disposes(() => {
    client.end()
  })
```

This way we can run the function like before. The connection is established only the first time and reused across multiple usages of run. We can then close the connection using shutdown.

```js
await userQuery.run({ userId: 12345 })
// ...
await dbConnection.shutdown() // this returns true if the "dispose" function is executed
```

It is often more practical to keep track of all dependencies executed and shut them down using a single command (and in the right order). We do that passing a context to _run_:

```js
const { Context } = require("sistema")

const context = new Context()

await userQuery.run({ userId: 12345 }, context)
// ...
await context.shutdown() // this shutdown all Dependency that have been executed in the same context
```

Once a Dependency or a ResourceDependency are shutdown, they no longer works and return an exception when called.
It is possible to reset a graph of dependencies so that all ResourceDependencies are closed (their "dispose" function is called), but they can still be used and recreated.

```js
await context.reset()
```

A Dependency shuts down when there are no in-flights calls to the function provided.
A ResourceDependency shuts down when the dispose function returns.

## Default context

When no context is passed to _run_, a default context is automatically used. So we can rewrite the previous example like this:

```js
const { defaultContext } = require("sistema")

await userQuery.run({ userId: 12345 })
// ...
await defaultContext.shutdown() // this shutdown all Dependencies that have been executed
```

## Multiple contexts

When dealing with dependencies that are part of different workflows you can use more than one context.
So that shutting down (or resetting) a group of dependencies doesn't shut down another group.
If a dependency belongs to multiple groups, it can only shutdown after all groups shut down.

## Run multiple dependencies at once

Promise.all can be used to run multiple dependencies at once:

```js
const [a, b] = await Promise.all([depA.run(), depB.run()])
```

This should return the correct result (if the dependencies are pure functions). But common dependencies can be executed multiple times. To avoid this, you can use run:

```js
const { run } = require("sistema")
const [a, b] = await run([depA, depB])
```

"run" can also be used to run a single dependency:

```js
depA.run()
// is equivalent to
run(depA)
```

# Observability

Sistema has some facility to help observe how the system works and to make it easier to debug and log.
Both Dependency, ResourceDependency and Context, can have a descriptive name:

```js
const userQuery = new Dependency('User query')...
```

That can be read in the name attribute:

```js
console.log(userQuery.name) // 'User query'
```

A context can be configured with event handlers that are executed when a dependency is executed with success or fail. Same for the shutdown.

```js
const context = new Context("main context")
  .onSuccessRun((dep, ctx, info) => {
    // example: 'User query ran by the main context in 14 ms'
    console.log(
      `${dep.name} ran by the ${ctx.name} in ${
        performance.now() - opts.startedOn
      } ms`
    )
  })
  .onFailRun((dep, ctx, info) => {
    console.log(
      `${dep.name} ran with Error (${opts.error.message}) by the ${
        ctx.name
      } in ${performance.now() - opts.startedOn} ms`
    )
  })
  .onSuccessShutdown((dep, ctx, opts) => {
    console.log(
      `${dep.name} was shutdown by the ${ctx.name} in ${
        performance.now() - opts.startedOn
      } ms`
    )
  })
  .onFailShutdown((dep, ctx, opts) => {
    console.log(
      `${dep.name} was shutdown with Error (${opts.error.message}) by the ${
        ctx.name
      } in ${performance.now() - opts.startedOn} ms`
    )
  })
```

There is also _onSuccessReset_ and _onFailReset_

Dependencies have extra attributes and methods that help with the debugging:

```js
const dep = new ResourceDependency("Test")
dep.toString() // returns "ResourceDependency Test"
dep.getEdges() // returns the dependencies as an array
dep.getInverseEdges() // returns all the dependents as an array
```

# Testability

With sistema we can test a dependency mocking easily any dependency. Just passing it in the run method using a Map:

```js
const args = new Map([
  [userId, 12345],
  [dbConnection, connectionMock],
])
await userQuery.run(args)
```

_connectionMock_ will be used instead of dbConnection.
This can be used to mock some or even all of the dependencies in the dependency graph. To implement unit and integration tests.

## Sistema Design principles

**Sistema** (Italian for "system") allows to express an application as a directed acyclic graph of functions. It executes the graphs of functions so that the dependencies constraint is respected. The algorithm is a derivative of DFS similar to [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) that walks multiple graph edges in parallel. In the same way is possible to shutdown the dependencies in the inverse order.

![Graph example](docs/example.png)

**Sistema** does one thing well. It integrates with other libraries rather than be an invasive framework. It has no dependencies and only a small amount of dev dependencies. It uses types but no transpilation for the best dev experience.

Sistema is:

- FAST: dependencies are executed in parallel, in the optimal order and only once every execution
- TESTABLE: Sistema takes care of the wiring, so that dependencies can be tested in isolation
- RELIABLE: Sistema takes care of shutting dependencies in the right order

## How it differs from Systemic

I enjoyed using [Systemic](https://github.com/onebeyond/systemic) and its predecessor [electrician](https://github.com/tes/electrician) for a long time. _Sistema_ differs in a few key aspects:

- With Sistema you can define a dependency in an external package, **including its dependencies**. This is not possible with Systemic, because it uses a centralised dependencies registry that needs to be defined in the application
- Sistema uses references instead of strings to define a dependency. This prevents typos and makes not possible to define cyclic dependencies that would reveal themselves only at runtime
- Sistema runs all dependencies in parallel, instead of doing that in series. Same with shutting down.
- Sistema can be used to define all kind of dependencies, not just the ones necessaries to start the application
