const AdjacencyListUtils = require("./AdjacencyListUtils")
const { Dependency } = require("./dependency")
const gracefully = require("gracefully")

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
    if (dep instanceof Dependency) {
      this.startedDependencies.add(dep)
    }

    const _cache = cacheToMap(cache)

    const getPromiseFromDep = (dep) => {
      return Promise.resolve().then(() => {
        if (!_cache.has(dep.id)) {
          const value = getPromisesFromDeps(dep.deps()).then((deps) =>
            dep.getValue(...deps)
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
    const stoppedDependencies = new Set()

    // if all nodes of the graph have at least a dependency, there is no way to
    // stop the dependencies in the right order (there are cycles)
    if (adj.emptyDeps.size === 0 && adj.adjacencyList.size !== 0) {
      throw new Error(
        "The dependency graph is not a DAC (directed acyclic graph)"
      )
    }

    const shutDownDep = async (d) => {
      if (stoppedDependencies.has(d)) {
        // this dep is already being stopped, return a fulfilled Promise
        return
      }
      stoppedDependencies.add(d)
      // shutdown a dependency and return a promise if there are others
      await d.shutdown()
      adj.deleteFromInverseAdjacencyList(d)
      return Promise.all(Array.from(adj.emptyDeps).map(shutDownDep))
    }
    return Promise.all(Array.from(adj.emptyDeps).map(shutDownDep))
  }

  shutdownOnTerminate(options) {
    gracefully(() => this.shutdown, options)
  }
}

module.exports = Runner
