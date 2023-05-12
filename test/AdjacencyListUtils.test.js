const AdjacencyListUtils = require("../src/AdjacencyListUtils.js")
const { Dependency } = require("../index.js")

const assert = require("assert")

const { beforeEach, describe, it, oit } = require("zunit")

describe("AdjacencyListUtils", () => {
  let a, b, c, d

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
    a = new Dependency([], () => {})
    b = new Dependency([a], (a) => {})
    c = new Dependency([a, b], (a, b) => {})
    d = new Dependency([b, c], (b, c) => {})
  })

  it("initializes the adjacency list correctly", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    assert.equal(adj.adjacencyList.size, 4)
    assert.deepEqual(Array.from(adj.adjacencyList.get(a)), [])
    assert.deepEqual(Array.from(adj.adjacencyList.get(b)), [a])
    assert.deepEqual(Array.from(adj.adjacencyList.get(c)), [a, b])
    assert.deepEqual(Array.from(adj.adjacencyList.get(d)), [b, c])
  })

  it("initializes the inverseAdjacency list correctly", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    assert.equal(adj.inverseAdjacencyList.size, 4)

    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(a)), [b, c])
    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(b)), [c, d])
    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(c)), [d])
    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(d)), [])
  })

  it("initializes the emptyDeps list correctly", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    assert.equal(adj.emptyDeps.size, 1)

    assert.deepEqual(Array.from(adj.emptyDeps), [d])
  })

  it("removes an dependency", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    // delete d
    adj.deleteFromInverseAdjacencyList(d)
    assert.equal(adj.inverseAdjacencyList.size, 3)
    assert.equal(adj.adjacencyList.size, 3)

    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(a)), [b, c])
    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(b)), [c])
    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(c)), [])
    assert.deepEqual(Array.from(adj.emptyDeps), [c])

    // delete c
    adj.deleteFromInverseAdjacencyList(c)
    assert.equal(adj.inverseAdjacencyList.size, 2)
    assert.equal(adj.adjacencyList.size, 2)

    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(a)), [b])
    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(b)), [])
    assert.deepEqual(Array.from(adj.emptyDeps), [b])

    // delete b
    adj.deleteFromInverseAdjacencyList(b)
    assert.equal(adj.inverseAdjacencyList.size, 1)
    assert.equal(adj.adjacencyList.size, 1)

    assert.deepEqual(Array.from(adj.inverseAdjacencyList.get(a)), [])
    assert.deepEqual(Array.from(adj.emptyDeps), [a])

    // delete a
    adj.deleteFromInverseAdjacencyList(a)
    assert.equal(adj.inverseAdjacencyList.size, 0)
    assert.equal(adj.adjacencyList.size, 0)

    assert.deepEqual(Array.from(adj.emptyDeps), [])
  })

  it("removes a non existing dependency", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    try {
      adj.deleteFromInverseAdjacencyList({})
    } catch (e) {
      assert.equal(e.message, "This dependency cannot be removed")
    }
  })

  it("removes a non existing dependency", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    try {
      adj.deleteFromInverseAdjacencyList(a)
    } catch (e) {
      assert.equal(e.message, "This dependency cannot be removed")
    }
  })
})
