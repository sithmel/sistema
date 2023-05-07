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

const DEPENDENCY_ERROR =
  "A function can depend on an array of dependencies or a function returning an array of dependencies"

function getValidDependency(d) {
  if (d instanceof Dependency) {
    return d
  } else if (typeof d === "string") {
    return new ValueDependency(d)
  } else {
    throw new Error(DEPENDENCY_ERROR)
  }
}

class Dependency {
  constructor(deps, func) {
    this.id = this
    if (Array.isArray(deps)) {
      this._deps = deps.map(getValidDependency)
    } else {
      throw new Error(DEPENDENCY_ERROR)
    }

    this._isShuttingDown = false
    this.running = new Set()

    this.startFunc = (...args) => {
      if (this._isShuttingDown) {
        return Promise.reject(new Error("Shutting down"))
      }

      const promise = Promise.resolve()
        .then(() => func(...args))
        .then((res) => {
          this.running.delete(promise)
          return Promise.resolve(res)
        })
        .catch((err) => {
          this.running.delete(promise)
          return Promise.reject(err)
        })
      this.running.add(promise)
      return promise
    }
  }

  deps() {
    return this._deps
  }

  shutdown() {
    this._isShuttingDown = true
    return Promise.all(
      Array.from(this.running).map((promise) =>
        promise.catch(() => Promise.resolve(null))
      )
    )
  }
}

class ValueDependency extends Dependency {
  constructor(value) {
    super([], () => {
      throw new Error(`Missing argument: ${value}`)
    })
    this.id = value
  }
  shutdown() {
    return Promise.resolve()
  }
}

class SystemDependency extends Dependency {
  constructor(deps, startFunc, stopFunc) {
    super(deps, startFunc)
    this.stopFunc = stopFunc
    const originalStartFunction = this.startFunc

    this.startFunc = (...args) => {
      if (this.isMemoized) {
        return this.memo
      }
      const p = Promise.resolve()
        .then(() => originalStartFunction(...args))
        .catch((err) => {
          this.reset()
          throw err
        })
      this.isMemoized = true
      this.memo = p
      return p
    }
    this.isMemoized = false
    this.memo = undefined
  }

  deps() {
    if (this.isMemoized) return []
    return super.deps()
  }

  shutdown() {
    this.reset()
    return super.shutdown().then(this.stopFunc)
  }

  reset() {
    this.isMemoized = false
    this.memo = undefined
  }
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

    // build adjacency list and inverse adjacency list
    const adjacencyList = new Map()
    const inverseAdjacencyList = new Map() // adjacency list with reversed edges

    Array.from(this.startedDependencies.values()).forEach((d) => {
      const deps = d.deps()
      adjacencyList.set(d, new Set(deps))
      deps.forEach((dep) => {
        if (!inverseAdjacencyList.has(dep)) {
          inverseAdjacencyList.set(dep, new Set())
        }
        inverseAdjacencyList.get(dep).add(d)
      })
    })

    // identify all items without dependencies in the dependency list
    const dependenciesToStop = Array.from(inverseAdjacencyList.entries())
      .filter(([_id, deps]) => deps.size === 0)
      .map(([id, _deps]) => id)

    const stopDeps = async (deps) => {
      await Promise.all(
        deps.map(async (d) => {
          await d.shutdown()
          // remove the dependency in the inverse dependency list O(1)
          inverseAdjacencyList.delete(d)
          // if the size of the inverse adjacency list is 0 I have finished the work
          if (inverseAdjacencyList.size == 0) {
            return Promise.resolve()
          }
          // remove the dependency from the set with the help of the adjacency list
          const dependenciesToStop = adjacencyList.get(d).map((dep) => {
            const deps = inverseAdjacencyList.get(dep)
            deps.delete(d)
            return deps.size === 0
          })
          // if after these removals there is no dependency with no dependencies
          if (dependenciesToStop.length === 0) {
            return Promise.reject(new Error("error"))
          }
          return stopDeps(dependenciesToStop)
        })
      )
    }

    this.startedDependencies = new Set()
    return stopDeps(dependenciesToStop)
  }
}

module.exports = {
  Dependency,
  SystemDependency,
  Runner,
}
