# Sistema

Sistema is a lightweight dependency injection library for node.js. It makes possible to write fast, testable and reliable applications.

# The dependency

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

A dependency can depend on others (just one in the example but they can be multiple!):

```js
const usersQuery = new Dependency()
  .dependsOn(dbConnection)
  .provides(async (client) => {
    const result = await client.query("SELECT * FROM users")
    return result.rows
  })
```

A dependency is executed with:

```js
usersQuery.run().then((rows) => {
  rows.forEach((row) => console.log(row))
})
```

The output of run is always a promise.

# Parameters

A dependency can take parameters, these are expressed as strings:

```js
const userQuery = new Dependency()
  .dependsOn(dbConnection, "userId")
  .provides(async (client) => {
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

## SystemDependencies and context

In the previous example we open a database connection every time we need a dbConnection. Some dependencies are better to be created once and then reused. And in the case of a database connection we also have to close the connection:

```js
const { SystemDependency } = require("sistema")
const { Client } = require("pg")

let client

const dbConnection = new SystemDependency()
  .provides(async () => {
    client = new Client()
    // Connect to the PostgreSQL database
    return client.connect()
  })
  .dispose(() => {
    client.end()
  })
```

This way we can run the function like before. The connection is established only the first time and reused across multiple usages of run. We can then close the connection using shutdown.

```js
await userQuery.run({ userId: 12345 })
// ...
await dbConnection.shutdown() // this returns true if the dispose is executed successfully
```

It is often more practical to keep track of all dependencies executed and shut them down in a single command (and in the right order). We do that passing a context to run:

```js
const { Context } = require("sistema")

const context = new Context()

await userQuery.run({ userId: 12345 }, context)
// ...
await context.shutdown() // this shutdown all SystemDependencies that have been executed
```

# Observability

Sistema has some facility to help observe how the system works and to make it easier to debug.
Both Dependency, SystemDependency and Context, can have a descriptive name:

```js
const userQuery = new Dependency('User query')...
```

A context can be configured with event handlers that are executed when a dependency is executed with success or fail. Same for the shutdown.

```js
const context = new Context("main context")
  .onSuccessRun((dep, ctx, opts) => {
    // example: 'User query run by main context in 14 ms'
    console.log(
      `${dep.name} run by ${ctx.name} in ${
        (performance.now() - opts.startedOn) / 1000
      }ms`
    )
  })
  .onFailRun((dep, ctx, opts) => {
    console.log(
      `${dep.name} run with Error (${opts.error.message}) by ${ctx.name} in ${
        (performance.now() - opts.startedOn) / 1000
      }ms`
    )
  })
  .onSuccessShutdown((dep, ctx, opts) => {
    console.log(
      `${dep.name} shutdown by ${ctx.name} in ${
        (performance.now() - opts.startedOn) / 1000
      }ms`
    )
  })
  .onFailShutdown((dep, ctx, opts) => {
    console.log(
      `${dep.name} shutdown with Error (${opts.error.message}) by ${
        ctx.name
      } in ${(performance.now() - opts.startedOn) / 1000}ms`
    )
  })
```

# Testability

With sistema we can test a dependency mocking easily any dependency. Just passing it in the run method:

```js
const args = new Map([
  [userId, 12345],
  [dbConnection, connectionMock],
])
await userQuery.run(args)
```

# Sistema Design principles

- FAST: dependencies are executed in parallel, in the optimal order and only once
- TESTABLE: sistema takes care of the wiring, so that dependencies can be tested in isolation
- RELIABLE: sistema takes care of shutting dependencies in the right order
- LIGHTWEIGHT: sistema should do one thing well, and integrate well with other libraries
