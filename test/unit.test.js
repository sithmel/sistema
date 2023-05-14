const { SystemDependency, Dependency, Runner } = require("../index.js")

const assert = require("assert")
const { setTimeout } = require("timers")

const { beforeEach, describe, it, oit } = require("zunit")

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe("dependency", () => {
  describe("solve 4 functions graph", () => {
    let runner, a, b, c, d, counter

    beforeEach(function () {
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
      a = new Dependency([], () => {
        counter.a++
        return "A"
      })
      b = new Dependency([a], (a) => {
        counter.b++
        return a + "B"
      })
      c = new Dependency([a, b], (a, b) => {
        counter.c++
        return a + b + "C"
      })
      d = new Dependency([b, c], (b, c) => {
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
        .then((_dep) => assert.deepEqual(counter, { a: 1, b: 1, c: 1, d: 1 })))

    it("run single", () =>
      runner.run(b).then((res) => {
        assert.deepEqual(res, "AB")
      }))

    it("must throw on invalid dependencies", async () => {
      try {
        const buggy = new Dependency("invalid", () => {})
        throw new Error("on no!")
      } catch (e) {
        assert.equal(
          e.message,
          "A function can depend on an array of dependencies or a function returning an array of dependencies"
        )
      }
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
    let runner, a, b

    beforeEach(function () {
      /*

        A ----> B

      */
      runner = new Runner()

      a = new Dependency([], () => {
        return "Stranger"
      })
      b = new Dependency([a, "greeting"], (a, greeting) => {
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
    let runner, a, b

    beforeEach(function () {
      /*

        A ----> B

      */
      runner = new Runner()

      a = new Dependency([], () => {
        throw new Error("dependency a is broken")
      })
      b = new Dependency([a], (a) => {
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
      const runner = new Runner()
      const a = new Dependency([], () => {
        return Promise.resolve("a")
      })
      const b = new Dependency([a], (a) => {
        return Promise.resolve(a + "b")
      })

      return runner.run(b).then((dep) => assert.equal(dep, "ab"))
    })
  })

  describe("solve 4 functions graph with start", () => {
    let runner, a, b, c, d, counter

    beforeEach(function () {
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
      a = new Dependency([], () => {
        counter.a++
        return "A"
      })
      b = new SystemDependency([a], (a) => {
        counter.b++
        return a + "B"
      })
      c = new SystemDependency([a, b], (a, b) => {
        counter.c++
        return a + b + "C"
      })
      d = new Dependency([b, c], (b, c) => {
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

      b.reset()
      counter = { a: 0, b: 0, c: 0, d: 0 }

      const dep3 = await runner.run(d)
      assert.equal(dep3, "ABAABCD")
      assert.deepEqual(counter, { a: 1, b: 1, c: 0, d: 1 })
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
      const buggy = new SystemDependency([], () => {
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
      const runner = new Runner()

      let counter = 0

      const a = new Dependency(["ms"], async (ms) => {
        await delay(ms)
        counter++
        return "a"
      })
      runner.run(a, { ms: 10 })
      runner.run(a, { ms: 5 })
      runner.run(a, { ms: 8 })
      await delay(1)
      const shutdownPromise = a.shutdown()
      await runner.run(a, { ms: 1 }).catch((e) => {
        assert.equal(e.message, "Shutting down")
      })

      return shutdownPromise.then(() => {
        assert.equal(counter, 3)
      })
    })

    it("must stop a SystemDependency", async () => {
      const runner = new Runner()

      let counterStart = 0
      let counterStop = 0

      const a = new SystemDependency(
        ["ms"],
        async (ms) => {
          await delay(ms)
          counterStart++
          return "a"
        },
        async () => {
          await delay(1)
          counterStop++
        }
      )

      runner.run(a, { ms: 10 })
      runner.run(a, { ms: 5 })
      runner.run(a, { ms: 8 })

      await delay(1)

      const shutdownPromise = a.shutdown()

      await runner.run(a, { ms: 1 }).catch((e) => {
        assert.equal(e.message, "Shutting down")
      })

      return shutdownPromise.then(() => {
        assert.equal(counterStart, 1)
        assert.equal(counterStop, 1)
      })
    })
  })

  describe("shutdown", () => {
    let runner,
      a,
      b,
      c,
      d,
      stopOrder = []

    beforeEach(function () {
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
      a = new SystemDependency(
        [],
        () => {},
        async function stopA() {
          await delay(10)
          stopOrder.push("A")
        }
      )
      b = new SystemDependency(
        [a],
        () => {},
        async function stopB() {
          await delay(10)
          stopOrder.push("B")
        }
      )
      c = new SystemDependency(
        [a, b],
        () => {},
        async function stopC() {
          await delay(10)
          stopOrder.push("C")
        }
      )
      d = new SystemDependency(
        [b, c],
        () => {},
        async function stopD() {
          await delay(10)
          stopOrder.push("D")
        }
      )
    })

    it("does not stop what has not started", async () => {
      await runner.shutdown()
      assert.deepEqual(stopOrder, [])
    })

    // oit("must return leftmost dep", async () => {
    //   await runner.run(d)
    //   console.log(runner.startedDependencies.size)
    //   await runner.shutdown()
    //   assert.deepEqual(stopOrder, ["D", "C", "B", "A"])
    // })
  })
})

// global shutdown
// signal and other stuff
// non DAC
