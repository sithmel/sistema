/*
  ValueDependency is a fake dependency that is expressed as "string"
  it throws an error when executed because it should always be passed
  as parameter
*/
class ValueDependency {
  constructor(name) {
    this.id = name
  }
  getValue() {
    throw new Error(`Missing argument: ${this.id}`)
  }
  deps() {
    return []
  }
}

/*
  this wraps a function adding extra features:
  - dependencies that needs to be executed before in order to execute this
  - a way to shut down this function: disable its execution and ensure is no longer running
*/
class Dependency {
  constructor(name) {
    this.edgesAndValues = []
    this.inverseEdges = new Set()

    this.id = this
    this.name = name
    this._func = () => {}
    this.contextItems = new Set()
  }
  deps() {
    return this.edgesAndValues
  }
  getValue(...args) {
    return Promise.resolve().then(() => this._func(...args))
  }
  toString() {
    return `${this.constructor.name} ${this.name}`
  }
  getEdges() {
    return this.edgesAndValues.filter((d) => d instanceof Dependency)
  }
  getInverseEdges() {
    return Array.from(this.inverseEdges)
  }
  run(cache = {}, context) {
    return run(this, cache, context)
  }
  dependsOn(...deps) {
    this.edgesAndValues = deps.map((d) => {
      if (d instanceof Dependency) {
        return d
      } else if (typeof d === "string") {
        return new ValueDependency(d)
      } else {
        throw new Error("A function can depend on a dependency or a string")
      }
    })
    this.edgesAndValues
      .filter((d) => d instanceof Dependency)
      .forEach((d) => {
        d.inverseEdges.add(this)
      })
    return this
  }

  provides(func) {
    this._func = func
    return this
  }

  _shutdown() {
    return Promise.resolve()
  }
}

/*
  This dependency is returned by a function, but its results is memoized and reused.
  For example a connection to a database. It also has stop method to shutdown gracefully
*/
class SystemDependency extends Dependency {
  constructor(name) {
    super(name)
    this.isMemoized = false
    this.memo = undefined
  }

  getValue(...args) {
    if (this.isMemoized) {
      return this.memo
    }
    const p = Promise.resolve()
      .then(() => this._func(...args))
      .catch((err) => {
        this._reset()
        throw err
      })
    this.isMemoized = true
    this.memo = p
    return p
  }

  dispose(func) {
    this.stopFunc = func
    return this
  }

  _shutdown() {
    if (this.contextItems.size !== 0) {
      return Promise.resolve()
    }

    if (!this.isMemoized) {
      return super._shutdown()
    }

    this._reset()
    return super._shutdown().then(this.stopFunc)
  }

  _reset() {
    this.isMemoized = false
    this.memo = undefined
  }
}

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

class Context {
  constructor() {
    this.startedDependencies = new Set()
  }
  add(dep) {
    this.startedDependencies.add(dep)
    dep.contextItems.add(this)
  }
  remove(dep) {
    this.startedDependencies.delete(dep)
    dep.contextItems.delete(this)
  }
  has(dep) {
    return this.startedDependencies.has(dep)
  }
  size() {
    return this.startedDependencies.size
  }
  getFirst() {
    return Array.from(this.startedDependencies)[0]
  }
  shutdown() {
    if (this.size() === 0) {
      return Promise.resolve()
    }

    const shutDownDep = async (d) => {
      if (!this.has(d)) {
        return
      }
      this.remove(d)
      await Promise.all(d.getInverseEdges().map(shutDownDep))
      return d._shutdown()
    }

    return shutDownDep(this.getFirst()).then(() => this.shutdown())
  }
}

function run(dep, cache = {}, context) {
  const _cache = cacheToMap(cache)

  const getPromiseFromDep = (dep) => {
    if (context != null && dep instanceof Dependency) {
      context.add(dep)
    }
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
  const getPromisesFromDeps = (deps) => Promise.all(deps.map(getPromiseFromDep))

  return Array.isArray(dep) ? getPromisesFromDeps(dep) : getPromiseFromDep(dep)
}

module.exports = {
  Dependency,
  SystemDependency,
  Context,
  run,
}
