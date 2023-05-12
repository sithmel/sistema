const AdjacencyListUtils = require("./AdjacencyListUtils")

function cacheToMap(obj) {
  if (obj instanceof Map) {
    return obj
  }
  if (Array.isArray(obj)) {
    return new Map(obj) // I consider obj to be an array of key value pairs
  }
  if (typeof obj === "object") {
    return new Map(Object.entries(obj))
  }
  throw new Error(
    "Cache must be either a Map, an array of key/value pairs or an object"
  )
}

class Runner {
  constructor() {
    this.startedDependencies = new Set()
  }

  run(dep, cache = {}) {
    const _cache = cacheToMap(cache)

    const getPromiseFromDep = (dep) => {
      this.startedDependencies.add(dep)
      return Promise.resolve().then(() => {
        if (!_cache.has(dep.id)) {
          const value = getPromisesFromDeps(dep.deps()).then((deps) =>
            dep.startFunc(...deps)
          )
          _cache.set(dep.id, value)
        }
        return _cache.get(dep.id)
      })
    }
    const getPromisesFromDeps = (deps) =>
      Promise.all(deps.map(getPromiseFromDep))

    return getPromiseFromDep(dep)
  }

  shutdown() {
    if (this.startedDependencies.size === 0) {
      return Promise.resolve()
    }

    const adj = new AdjacencyListUtils(Array.from(this.startedDependencies))

    if (adj.emptyDeps.size === 0 && adj.adjacencyList.size !== 0) {
      throw new Error(
        "The dependency graph is not a DAC (directed acyclic graph)"
      )
    }

    const dependenciesBeingShutDown = new Set()

    const shutDownDep = async (d) => {
      if (dependenciesBeingShutDown.has(d)) {
        return
      }
      dependenciesBeingShutDown.add(d)
      // shutdown a dependency and return a promise if there are others
      await d.shutdown()
      adj.deleteFromInverseAdjacencyList(d)
      return Promise.all(Array.from(adj.emptyDeps).map(shutDownDep))
    }
    this.startedDependencies = new Set()
    return Promise.all(Array.from(adj.emptyDeps).map(shutDownDep))
  }
}

module.exports = Runner
