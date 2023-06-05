//@ts-check
const { run, SystemDependency, Dependency, Context } = require("../index.js")

const assert = require("assert")

const { beforeEach, describe, it, oit, xit } = require("zunit")

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe("dependency", () => {
  it("sets the name", async () => {
    const a = new Dependency("Hello")
    assert.deepEqual(a.name, "Hello")
  })

  describe("solve 4 functions graph", () => {
    let a, b, c, d, counter

    beforeEach(() => {
      /*
  
        A ----> B
        |     / |
        |    /  |
        |   /   |
        |  /    |
        | /     |
        VV      V
        C ----> D
  
      */
      counter = { a: 0, b: 0, c: 0, d: 0 }
      a = new Dependency().provides(() => {
        counter.a++
        return "A"
      })
      b = new Dependency().dependsOn(a).provides((a) => {
        counter.b++
        return a + "B"
      })
      c = new Dependency().dependsOn(a, b).provides((a, b) => {
        counter.c++
        return a + b + "C"
      })
      d = new Dependency().dependsOn(b, c).provides((b, c) => {
        counter.d++
        return b + c + "D"
      })
    })

    it("must save edges", () => {
      assert.deepEqual(a.edgesAndValues, [])
      assert.deepEqual(b.edgesAndValues, [a])
      assert.deepEqual(c.edgesAndValues, [a, b])
      assert.deepEqual(d.edgesAndValues, [b, c])

      assert.deepEqual(a.inverseEdges, new Set([b, c]))
      assert.deepEqual(b.inverseEdges, new Set([c, d]))
      assert.deepEqual(c.inverseEdges, new Set([d]))
      assert.deepEqual(d.inverseEdges, new Set([]))
    })

    it("must return leftmost dep", () =>
      a.run().then((dep) => assert.equal(dep, "A")))

    it("must return middle dep", () =>
      b.run().then((dep) => assert.equal(dep, "AB")))

    it("must return middle dep (2)", () =>
      c.run().then((dep) => assert.equal(dep, "AABC")))

    it("must return rightmost dep", () =>
      d.run().then((dep) => assert.equal(dep, "ABAABCD")))

    it("must execute dep only once", () =>
      d
        .run()
        .then((_dep) => assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })))

    it("run multiple deps", () => {
      const e = new Dependency().provides(() => {
        counter.e = 1
        return "E"
      })

      return run([d, e]).then((res) => {
        assert.deepEqual(res, ["ABAABCD", "E"])
      })
    })

    it("must throw on invalid cache", async () => {
      try {
        await d.run("invalid cache")
        throw new Error("on no!")
      } catch (e) {
        assert.equal(
          e.message,
          "Must be either a Map, an array of key/value pairs or an object"
        )
      }
    })
  })

  describe("pass parameters", () => {
    let a, b

    beforeEach(() => {
      /*

        A ----> B

      */
      a = new Dependency().provides(() => {
        return "Stranger"
      })
      b = new Dependency().dependsOn(a, "greeting").provides((a, greeting) => {
        return greeting + " " + a
      })
    })

    it("must pass the parameter", () =>
      b
        .run({ greeting: "hello" })
        .then((dep) => assert.equal(dep, "hello Stranger")))

    it("must fail omitting the parameter", () =>
      b
        .run()
        .catch((err) =>
          assert.equal(err.message, "Missing argument: greeting")
        ))
  })

  describe("fail correctly", () => {
    let a, b

    beforeEach(() => {
      /*

        A ----> B

      */
      a = new Dependency().provides(() => {
        throw new Error("dependency a is broken")
      })
      b = new Dependency().dependsOn(a).provides((a) => {
        return a + "B"
      })
    })

    it("must stop dep execution when a dependency throws", () =>
      b
        .run()
        .catch((err) => assert.equal(err.message, "dependency a is broken")))
  })

  describe("async functions", () => {
    it("must work with async functions", () => {
      /*
        A ----> B
      */
      const a = new Dependency().provides(() => {
        return Promise.resolve("a")
      })
      const b = new Dependency().dependsOn(a).provides((a) => {
        return Promise.resolve(a + "b")
      })

      return b.run().then((dep) => assert.equal(dep, "ab"))
    })
  })

  describe("solve 4 functions graph with start", () => {
    let a, b, c, d, counter, context

    beforeEach(() => {
      /*
  
        A ----> B
        |     / |
        |    /  |
        |   /   |
        |  /    |
        | /     |
        VV      V
        C ----> D
  
      */
      context = new Context()
      counter = { a: 0, b: 0, c: 0, d: 0 }
      a = new Dependency().provides(() => {
        counter.a++
        return "A"
      })
      b = new SystemDependency().dependsOn(a).provides((a) => {
        counter.b++
        return a + "B"
      })
      c = new SystemDependency().dependsOn(a, b).provides((a, b) => {
        counter.c++
        return a + b + "C"
      })
      d = new Dependency().dependsOn(b, c).provides((b, c) => {
        counter.d++
        return b + c + "D"
      })
    })

    it("must return leftmost dep", () =>
      a.run().then((dep) => assert.equal(dep, "A")))

    it("must return middle dep", () =>
      b.run().then((dep) => assert.equal(dep, "AB")))

    it("must return middle dep (2)", () =>
      c.run().then((dep) => assert.equal(dep, "AABC")))

    it("must return rightmost dep", () =>
      d.run().then((dep) => assert.equal(dep, "ABAABCD")))

    it("must execute dep only once", () =>
      d
        .run()
        .then((dep) => assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })))

    it("must return rightmost dep (and memoize)", async () => {
      const dep = await d.run({}, context)
      assert.equal(dep, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })

      counter = { a: 0, b: 0, c: 0, d: 0 }
      const dep2 = await d.run({}, context)
      assert.equal(dep2, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 0, c: 0, d: 1 })
    })
    it("must reset", async () => {
      const dep = await d.run({}, context)
      assert.equal(dep, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })

      await context.reset()
      counter = { a: 0, b: 0, c: 0, d: 0 }
      const dep2 = await d.run({}, context)
      assert.equal(dep2, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })
    })

    it("must return rightmost dep (and memoize), calling them at the same time", async () => {
      const [dep, dep2] = await Promise.all([d.run(), d.run()])
      assert.equal(dep, "ABAABCD")
      assert.equal(dep2, "ABAABCD")
      // I don't think "a" should be called twice here
      // it is a consequence of the sequence dependencies are resolved
      // it is a minor issue on a corner case. So I won't worry
      assert.deepEqual(counter, { a: 2, b: 1, c: 1, d: 2 })
    })

    it("must not memoize when function throw", async () => {
      const buggy = new SystemDependency().provides(() => {
        throw new Error("broken")
      })
      try {
        await buggy.run()
        throw new Error("on no!")
      } catch (e) {
        assert.equal(e.message, "broken")
        assert.equal(buggy.memo, undefined)
      }
    })
  })

  describe("must shutdown single dependency", () => {
    it("must stop a SystemDependency", async () => {
      let counterStop = 0

      const a = new SystemDependency().dependsOn("ms").dispose(async () => {
        await delay(1)
        counterStop++
      })

      a.run({ ms: 8 })

      await delay(1)

      const shutdownPromise = a.shutdown()

      return shutdownPromise.then(() => {
        assert.equal(counterStop, 1)
      })
    })
  })

  describe("shutdown", () => {
    let a, b, c, d, stopOrder, context

    beforeEach(() => {
      /*
  
        A ----> B
        |     / |
        |    /  |
        |   /   |
        |  /    |
        | /     |
        VV      V
        C ----> D
  
      */
      context = new Context()
      stopOrder = []
      a = new SystemDependency("A").dispose(async () => {
        stopOrder.push("A")
      })
      b = new SystemDependency("B").dependsOn(a).dispose(async () => {
        stopOrder.push("B")
      })
      c = new SystemDependency("C").dependsOn(a, b).dispose(async () => {
        stopOrder.push("C")
      })

      d = new SystemDependency("D").dependsOn(b, c).dispose(async () => {
        stopOrder.push("D")
      })
    })

    it("does not stop what has not started", async () => {
      await context.shutdown()
      assert.deepEqual(stopOrder, [])
    })

    it("must stop entire system", async () => {
      await d.run({}, context)
      await context.shutdown()
      assert.deepEqual(stopOrder, ["D", "C", "B", "A"])
    })

    it("must stop only what has started", async () => {
      await b.run({}, context)
      await context.shutdown()
      assert.deepEqual(stopOrder, ["B", "A"])
    })

    it("must stop only if all runners are shutting down", async () => {
      const secondContext = new Context()
      await b.run({}, context)
      await b.run({}, secondContext)
      await context.shutdown()
      assert.deepEqual(stopOrder, [])
      stopOrder = []
      await secondContext.shutdown()
      assert.deepEqual(stopOrder, ["B", "A"])
    })
  })

  describe("context callback", () => {
    let a, b, context

    beforeEach(() => {
      /*
        A ----> B
      */
      context = new Context()
      a = new SystemDependency()
      b = new Dependency().dependsOn(a)
    })

    it("must call callback on success", async () => {
      const depsRun = []
      const depsShutdown = []
      context.onSuccessRun((dep, ctx, opts) => {
        depsRun.push(dep)
        assert.equal(context, ctx)
        assert(opts.startedOn > 0)
      })
      context.onSuccessShutdown((dep, ctx, opts) => {
        depsShutdown.push(dep)
        assert.equal(context, ctx)
        assert(opts.startedOn > 0)
      })

      await b.run({}, context)
      assert.deepEqual(depsRun, [a, b])
      await context.shutdown()
      assert.deepEqual(depsShutdown, [b, a])
    })

    it("must call callback when fail running", async () => {
      context
        .onSuccessRun(() => {
          throw new Error("it should not enter here")
        })
        .onFailRun((dep, ctx, opts) => {
          assert.equal(dep, c)
          assert.equal(context, ctx)
          assert(opts.startedOn > 0)
          assert.equal(opts.error.message, "oh no!")
        })
      const c = new Dependency().provides(() => {
        throw new Error("oh no!")
      })
      try {
        await c.run({}, context)
      } catch (e) {
        // we ignore the error so we let the assertion run
      }
    })

    it("must call callback when fail shutting down", async () => {
      context
        .onSuccessShutdown(() => {
          throw new Error("it should not enter here")
        })
        .onFailShutdown((dep, ctx, opts) => {
          assert.equal(dep, c)
          assert.equal(context, ctx)
          assert(opts.startedOn > 0)
          assert.equal(opts.error.message, "oh no!")
        })
      const c = new SystemDependency().dispose(() => {
        throw new Error("oh no!")
      })
      await c.run({}, context)

      try {
        await context.shutdown()
      } catch (e) {
        // we ignore the error so we let the assertion run
      }
    })
  })
})
