//@ts-check

/*
  ValueDependency is a fake dependency that is expressed as "string"
  it throws an error when executed because it should always be passed
  as parameter
*/
class ValueDependency {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.id = name
  }
  getValue() {
    throw new Error(`Missing argument: ${this.id}`)
  }
  /**
   * @return {Array<Dependency|ValueDependency>} name
   */
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
  /**
   * @param {?string} name
   */
  constructor(name) {
    this.edgesAndValues = []
    this.inverseEdges = new Set()

    this.id = this
    this.name = name
    this._func = (...args) => {}
    this.contextItems = new Set()
  }
  /**
   * @return {Array<Dependency|ValueDependency>} name
   */
  deps() {
    return this.edgesAndValues
  }
  /**
   * @param {any[]} args
   * @return {Promise}
   */
  getValue(...args) {
    return Promise.resolve().then(() => this._func(...args))
  }
  /**
   * @return {string}
   */
  toString() {
    return `${this.constructor.name} ${this.name}`
  }
  /**
   * @return {Array<Dependency>}
   */
  getEdges() {
    return this.edgesAndValues.filter((d) => d instanceof Dependency)
  }
  /**
   * @return {Array<Dependency>}
   */
  getInverseEdges() {
    return Array.from(this.inverseEdges)
  }
  /**
   * @param {Object} cache
   * @param {Context} context
   * @return {Promise}
   */
  run(cache = {}, context) {
    return run(this, cache, context)
  }

  /**
   * @param {(Dependency|string)[]} deps
   * @return {this}
   */
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

  /**
   * @param {() => {}} func
   * @return {this}
   */
  provides(func) {
    this._func = func
    return this
  }

  /**
   * @return {Promise<boolean>}
   */
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
  /**
   * @param {?string} name
   */
  constructor(name) {
    super(name)
    this.memo = undefined
  }
  /**
   * @param {any[]} args
   * @return {Promise<any>}
   */
  getValue(...args) {
    if (this.memo != null) {
      return this.memo
    }
    const p = Promise.resolve()
      .then(() => this._func(...args))
      .catch((err) => {
        this.memo = undefined
        throw err
      })
    this.memo = p
    return p
  }

  /**
   * @param {() => {}} func
   * @return {this}
   */
  dispose(func) {
    this.stopFunc = func
    return this
  }

  /**
   * @return {Promise<boolean>}
   */
  shutdown() {
    if (this.contextItems.size !== 0) {
      return Promise.resolve(false)
    }

    if (this.memo == null) {
      return Promise.resolve(false)
    }

    this.memo = undefined
    return Promise.resolve()
      .then(this.stopFunc)
      .then(() => true)
  }
}

/**
 * @param {Object<string, any>|Map<string|Dependency, any>|Iterable<string|Dependency, any>} obj
 */
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

class EmptyContext {
  constructor() {
    this.name = undefined
    this.successRun = (dep, ctx, info) => {}
    this.failRun = (dep, ctx, info) => {}
    this.successShutdown = (dep, ctx, info) => {}
    this.failShutdown = (dep, ctx, info) => {}
  }
  /**
   * @param {Dependency} dep
   */
  add(dep) {}
}
class Context extends EmptyContext {
  /**
   * @param {?string} name
   */
  constructor(name) {
    super()
    this.name = name
    this.startedDependencies = new Set()
  }
  /**
   * @typedef {{onStarted:number, error: ?Error}} ExecInfo
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onSuccessRun(func) {
    this.successRun = func
    return this
  }
  /**
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onFailRun(func) {
    this.failRun = func
    return this
  }
  /**
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onSuccessShutdown(func) {
    this.successShutdown = func
    return this
  }
  /**
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onFailShutdown(func) {
    this.failShutdown = func
    return this
  }
  /**
   * @param {Dependency} dep
   */
  add(dep) {
    this.startedDependencies.add(dep)
    dep.contextItems.add(this)
  }
  /**
   * @param {Dependency} dep
   */
  remove(dep) {
    this.startedDependencies.delete(dep)
    dep.contextItems.delete(this)
  }
  /**
   * @param {Dependency} dep
   */
  has(dep) {
    return this.startedDependencies.has(dep)
  }
  /**
   * @return {number}
   */
  size() {
    return this.startedDependencies.size
  }
  /**
   * @return {Dependency}
   */
  getFirst() {
    return Array.from(this.startedDependencies)[0]
  }
  /**
   * @return {Promise}
   */
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
      const startedOn = Date.now()
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

/**
 * @param {Dependency} dep
 * @param {Object|Map<string|Dependency, any>|Array<[string|Dependency, any]>} cache
 * @param {EmptyContext} context
 * @return {Promise}
 */
function run(dep, cache = {}, context = new EmptyContext()) {
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
