const { performance } = require("perf_hooks")

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

  shutdown() {
    // this returns true if a shutdown happens
    return Promise.resolve(false)
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

  shutdown() {
    if (this.contextItems.size !== 0) {
      return Promise.resolve(false)
    }

    if (!this.isMemoized) {
      return Promise.resolve(false)
    }

    this._reset()
    return Promise.resolve()
      .then(this.stopFunc)
      .then(() => true)
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

class NoContext {
  constructor() {
    this.name = undefined
    this.successRun = () => {}
    this.failRun = () => {}
    this.successShutdown = () => {}
    this.failShutdown = () => {}
  }
  add() {}
}
class Context extends NoContext {
  constructor(name) {
    super()
    this.name = name
    this.startedDependencies = new Set()
  }
  onSuccessRun(func) {
    this.successRun = func
    return this
  }
  onFailRun(func) {
    this.failRun = func
    return this
  }
  onSuccessShutdown(func) {
    this.successShutdown = func
    return this
  }
  onFailShutdown(func) {
    this.failShutdown = func
    return this
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
      const startedOn = performance.now()
      const shutdownPromise = d.shutdown()
      shutdownPromise
        .then(
          (hasShutdown) =>
            hasShutdown && this.successShutdown(d, this, { startedOn })
        )
        .catch((error) => this.failShutdown(d, this, { error, startedOn }))
      return shutdownPromise
    }

    return shutDownDep(this.getFirst()).then(() => this.shutdown())
  }
}

function run(dep, cache = {}, context = new NoContext()) {
  const _cache = cacheToMap(cache)

  const getPromiseFromDep = (dep) => {
    if (dep instanceof Dependency) {
      context.add(dep)
    }
    return Promise.resolve().then(() => {
      if (!_cache.has(dep.id)) {
        let startedOn
        const valuePromise = getPromisesFromDeps(dep.deps()).then((deps) => {
          startedOn = performance.now()
          return dep.getValue(...deps)
        })
        valuePromise
          .then(() => context.successRun(dep, context, { startedOn }))
          .catch((error) => {
            context.failRun(dep, context, { error, startedOn })
          })
        _cache.set(dep.id, valuePromise)
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
