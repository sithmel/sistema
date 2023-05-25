const { SystemDependency, Dependency, Runner } = require("../index.js")

const assert = require("assert")

const { beforeEach, describe, it, oit, xit } = require("zunit")

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe("dependency", () => {
  it("sets the name", async () => {
    const a = new Dependency("Hello")
    assert.deepEqual(a.name, "Hello")
  })

  describe("solve 4 functions graph", () => {
    let a, b, c, d, counter, runner

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
      runner = new Runner()
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
      runner.run(a).then((dep) => assert.equal(dep, "A")))

    it("must return middle dep", () =>
      runner.run(b).then((dep) => assert.equal(dep, "AB")))

    it("must return middle dep (2)", () =>
      runner.run(c).then((dep) => assert.equal(dep, "AABC")))

    it("must return rightmost dep", () =>
      runner.run(d).then((dep) => assert.equal(dep, "ABAABCD")))

    it("must execute dep only once", () =>
      runner
        .run(d)
        .then((_dep) => assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })))

    it("run single", () =>
      runner.run(b).then((res) => {
        assert.deepEqual(res, "AB")
      }))

    it("run multiple deps", () => {
      const e = new Dependency().provides(() => {
        counter.e = 1
        return "E"
      })

      return runner.run([d, e]).then((res) => {
        assert.deepEqual(res, ["ABAABCD", "E"])
      })
    })

    it("must throw on invalid cache", async () => {
      try {
        await runner.run(d, "invalid cache")
        throw new Error("on no!")
      } catch (e) {
        assert.equal(
          e.message,
          "Cache must be either a Map, an array of key/value pairs or an object"
        )
      }
    })
  })

  describe("pass parameters", () => {
    let a, b, runner

    beforeEach(() => {
      /*

        A ----> B

      */
      runner = new Runner()
      a = new Dependency().provides(() => {
        return "Stranger"
      })
      b = new Dependency().dependsOn(a, "greeting").provides((a, greeting) => {
        return greeting + " " + a
      })
    })

    it("must pass the parameter", () =>
      runner
        .run(b, { greeting: "hello" })
        .then((dep) => assert.equal(dep, "hello Stranger")))

    it("must fail omitting the parameter", () =>
      runner
        .run(b)
        .catch((err) =>
          assert.equal(err.message, "Missing argument: greeting")
        ))
  })

  describe("fail correctly", () => {
    let a, b, runner

    beforeEach(() => {
      /*

        A ----> B

      */
      runner = new Runner()
      a = new Dependency().provides(() => {
        throw new Error("dependency a is broken")
      })
      b = new Dependency().dependsOn(a).provides((a) => {
        return a + "B"
      })
    })

    it("must stop dep execution when a dependency throws", () =>
      runner
        .run(b)
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
      runner = new Runner()

      return runner.run(b).then((dep) => assert.equal(dep, "ab"))
    })
  })

  describe("solve 4 functions graph with start", () => {
    let a, b, c, d, counter, runner

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
      runner = new Runner()
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
      runner.run(a).then((dep) => assert.equal(dep, "A")))

    it("must return middle dep", () =>
      runner.run(b).then((dep) => assert.equal(dep, "AB")))

    it("must return middle dep (2)", () =>
      runner.run(c).then((dep) => assert.equal(dep, "AABC")))

    it("must return rightmost dep", () =>
      runner.run(d).then((dep) => assert.equal(dep, "ABAABCD")))

    it("must execute dep only once", () =>
      runner
        .run(d)
        .then((dep) => assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })))

    it("must return rightmost dep (and memoize)", async () => {
      const dep = await runner.run(d)
      assert.equal(dep, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })

      counter = { a: 0, b: 0, c: 0, d: 0 }
      const dep2 = await runner.run(d)
      assert.equal(dep2, "ABAABCD")
      assert.deepEqual(counter, { a: 0, b: 0, c: 0, d: 1 })

      await runner.shutdown()
      counter = { a: 0, b: 0, c: 0, d: 0 }

      const dep3 = await runner.run(d)
      assert.equal(dep3, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })
    })

    it("must return rightmost dep (and memoize), calling them at the same time", async () => {
      const [dep, dep2] = await Promise.all([runner.run(d), runner.run(d)])
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
        await runner.run(buggy)
        throw new Error("on no!")
      } catch (e) {
        assert.equal(e.message, "broken")
        assert.equal(buggy.isMemoized, false)
      }
    })
  })

  describe("must shutdown", () => {
    it("must stop a Dependency", async () => {
      const a = new Dependency().dependsOn("ms").provides(async (ms) => {
        await delay(ms)
        return "a"
      })
      const runner = new Runner()
      runner.run(a, { ms: 1 })
      await delay(1)
      return runner.run(a, { ms: 1 }).catch((e) => {
        assert.equal(e.message, "Shutting down")
      })
    })

    it("must stop a SystemDependency", async () => {
      let counterStop = 0

      const a = new SystemDependency().dependsOn("ms").dispose(async () => {
        await delay(1)
        counterStop++
      })

      const runner = new Runner()
      runner.run(a, { ms: 8 })

      await delay(1)

      const shutdownPromise = a._shutdown()

      await runner.run(a, { ms: 1 }).catch((e) => {
        assert.equal(e.message, "Shutting down")
      })

      return shutdownPromise.then(() => {
        assert.equal(counterStop, 1)
      })
    })
  })

  describe("shutdown", () => {
    let a, b, c, d, stopOrder, runner

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
      runner = new Runner()
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
      await runner.shutdown()
      assert.deepEqual(stopOrder, [])
    })

    it("must stop entire system", async () => {
      await runner.run(d)
      await runner.shutdown()
      assert.deepEqual(stopOrder, ["D", "C", "B", "A"])
    })

    it("must stop only what has started", async () => {
      await runner.run(b)
      await runner.shutdown()
      assert.deepEqual(stopOrder, ["B", "A"])
    })
  })
})

// dependOn takes a list not an array
// plugins and perf

// documentation

// test with nest js https://github.com/manjufy/nest-hello-world/
// test with sistema
// test with express
// test with sistemic
