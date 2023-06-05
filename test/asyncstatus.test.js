//@ts-check
const AsyncStatus = require("../asyncstatus.js")

const assert = require("assert")

const { beforeEach, it, describe } = require("zunit")

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe("status", () => {
  let status
  beforeEach(() => {
    status = new AsyncStatus("initial")
  })
  it("gets the status", async () => {
    const s = await status.get()
    assert.equal(s, "initial")
  })
  it("change the status", async () => {
    status.change("newState", Promise.resolve())
    const s = await status.get()
    assert.equal(s, "newState")
  })
  it("change the status, many times", async () => {
    status.change("newState1", Promise.resolve())
    status.change("newState2", Promise.resolve())
    status.change("newState3", Promise.resolve())
    const s = await status.get()
    assert.equal(s, "newState3")
  })
  it("change the status, ensure promises are fullfilled", async () => {
    let fulfilled = 0
    status.change(
      "newState1",
      delay(3).then(() => fulfilled++)
    )
    status.change(
      "newState2",
      delay(2).then(() => fulfilled++)
    )
    status.change(
      "newState3",
      delay(1).then(() => fulfilled++)
    )
    assert.equal(fulfilled, 0)
    const s = await status.get()
    assert.equal(fulfilled, 3)
    assert.equal(s, "newState3")
  })
})
