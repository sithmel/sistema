const AdjacencyListUtils = require("../src/AdjacencyListUtils.js")
const { Dependency } = require("../index.js")

const assert = require("assert")

const { beforeEach, describe, it, oit } = require("zunit")

describe("AdjacencyListUtils", () => {
  let a, b, c, d

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
    a = new Dependency()
    b = new Dependency().dependsOn([a])
    c = new Dependency().dependsOn([a, b])
    d = new Dependency().dependsOn([b, c])
  })

  it("initializes the adjacency list correctly", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    assert.equal(adj.adjacencyList.size, 4)
    assert.deepEqual(adj.adjacencyList.get(a), new Set())
    assert.deepEqual(adj.adjacencyList.get(b), new Set([a]))
    assert.deepEqual(adj.adjacencyList.get(c), new Set([a, b]))
    assert.deepEqual(adj.adjacencyList.get(d), new Set([b, c]))
  })

  it("initializes the inverseAdjacency list correctly", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    assert.equal(adj.inverseAdjacencyList.size, 4)

    assert.deepEqual(adj.inverseAdjacencyList.get(a), new Set([b, c]))
    assert.deepEqual(adj.inverseAdjacencyList.get(b), new Set([c, d]))
    assert.deepEqual(adj.inverseAdjacencyList.get(c), new Set([d]))
    assert.deepEqual(adj.inverseAdjacencyList.get(d), new Set([]))
  })

  it("initializes the adjacency list correctly, reconstructing the graph", () => {
    const adj = new AdjacencyListUtils([d])
    assert.equal(adj.adjacencyList.size, 4)
    assert.deepEqual(adj.adjacencyList.get(a), new Set([]))
    assert.deepEqual(adj.adjacencyList.get(b), new Set([a]))
    assert.deepEqual(adj.adjacencyList.get(c), new Set([a, b]))
    assert.deepEqual(adj.adjacencyList.get(d), new Set([b, c]))
  })

  it("initializes the inverseAdjacency list correctly, reconstructing the graph", () => {
    const adj = new AdjacencyListUtils([d])
    assert.equal(adj.inverseAdjacencyList.size, 4)

    assert.deepEqual(adj.inverseAdjacencyList.get(a), new Set([b, c]))
    assert.deepEqual(adj.inverseAdjacencyList.get(b), new Set([d, c]))
    assert.deepEqual(adj.inverseAdjacencyList.get(c), new Set([d]))
    assert.deepEqual(adj.inverseAdjacencyList.get(d), new Set())
  })

  it("initializes the emptyDeps list correctly", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    assert.equal(adj.emptyDeps.size, 1)

    assert.deepEqual(adj.emptyDeps, new Set([d]))
  })

  it("removes an dependency", () => {
    const adj = new AdjacencyListUtils([a, b, c, d])
    // delete d
    adj.deleteFromInverseAdjacencyList(d)
    assert.equal(adj.inverseAdjacencyList.size, 3)
    assert.equal(adj.adjacencyList.size, 3)

    assert.deepEqual(adj.inverseAdjacencyList.get(a), new Set([b, c]))
    assert.deepEqual(adj.inverseAdjacencyList.get(b), new Set([c]))
    assert.deepEqual(adj.inverseAdjacencyList.get(c), new Set([]))
    assert.deepEqual(adj.emptyDeps, new Set([c]))

    // delete c
    adj.deleteFromInverseAdjacencyList(c)
    assert.equal(adj.inverseAdjacencyList.size, 2)
    assert.equal(adj.adjacencyList.size, 2)

    assert.deepEqual(adj.inverseAdjacencyList.get(a), new Set([b]))
    assert.deepEqual(adj.inverseAdjacencyList.get(b), new Set([]))
    assert.deepEqual(adj.emptyDeps, new Set([b]))

    // delete b
    adj.deleteFromInverseAdjacencyList(b)
    assert.equal(adj.inverseAdjacencyList.size, 1)
    assert.equal(adj.adjacencyList.size, 1)

    assert.deepEqual(adj.inverseAdjacencyList.get(a), new Set([]))
    assert.deepEqual(adj.emptyDeps, new Set([a]))

    // delete a
    adj.deleteFromInverseAdjacencyList(a)
    assert.equal(adj.inverseAdjacencyList.size, 0)
    assert.equal(adj.adjacencyList.size, 0)

    assert.deepEqual(adj.emptyDeps, new Set())
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
