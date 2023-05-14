const { SystemDependency, Runner } = require("../index.js")

const assert = require("assert")
const { setTimeout } = require("timers")

const { afterEach, beforeEach, describe, xdescribe, it, oit } = require("zunit")

xdescribe("onTerminate", () => {
  let dep, buggyDep, done, runner
  let exit
  let started

  beforeEach(() => {
    exit = process.exit
    process.exitCode = undefined
    started = true

    done = false
    runner = new Runner({
      exitDelay: 1,
      stopWindow: 5,
      customEvent: "custom-stop",
    })
    dep = new SystemDependency("A").dispose(async () => {
      done = true
    })
    buggyDep = new SystemDependency("buggy").dispose(async () => {
      throw new Error("error")
    })
  })

  afterEach(() => {
    process.removeAllListeners()
    process.exit = exit
  })

  describe("'custom-stop' handling", () => {
    it("stops system gracefully", async () => {
      await runner.run(dep)

      const requestedCode = 2

      process.exit = function (code) {
        assert.strictEqual(code, requestedCode)
        assert(!started)
        done()
      }

      process.emit("custom-stop", { code: requestedCode })
    })

    // it("terminates system when graceful shutdown fails", async (done) => {
    //   await runner.run(buggyDep)
    //   process.exit = function (code) {
    //     assert.strictEqual(code, 1)
    //     done()
    //   }

    //   process.emit("custom-stop", { code: 2 })
    // })
  })

  Array.from(["SIGINT", "SIGTERM"]).forEach(function (signal) {
    describe(signal + " handling", function () {
      it("stops system gracefully", async () => {
        await runner.run(dep)
        process.exit = function (code) {
          assert.isUndefined(code)
          assert(!started)
          done()
        }

        process.emit(signal)
      })

      it("terminates system when not shut down gracefully in stop window", async () => {
        await runner.run(dep)

        process.exit = function (code) {
          assert.isUndefined(code)
          done()
        }

        process.emit(signal)
      })

      // it("terminates system when graceful shutdown fails", async () => {
      //   await runner.run(buggyDep)

      //   process.exit = function (code) {
      //     assert.strictEqual(code, 1)
      //     done()
      //   }
      //   process.emit(signal)
      // })
    })
  })
})
