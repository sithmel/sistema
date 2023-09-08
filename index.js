//@ts-check
const { performance } = require("perf_hooks")
const crypto = require("crypto")
const { EventEmitter } = require("events")
const AsyncStatus = require("./asyncstatus")

const EXECUTION_ID = "_id"
const META_DEPENDENCY = Symbol()
/**
 * Enum for Dependency status
 * @readonly
 * @enum {string}
 */
const DEPENDENCY_STATUS = {
  READY: "ready",
  SHUTDOWN: "shutdown",
}

/**
 * Enum context events
 * @readonly
 * @enum {string}
 */
const CONTEXT_EVENTS = {
  SUCCESS_RUN: "successRun",
  FAIL_RUN: "failRun",
  SUCCESS_SHUTDOWN: "successShutdown",
  FAIL_SHUTDOWN: "failShutdown",
  SUCCESS_RESET: "successReset",
  FAIL_RESET: "failReset",
}

/**
 * @param {Array<Dependency|ValueDependency>} depsOrValueDeps
 * @returns {Array<Dependency>}
 */
function filterDependency(depsOrValueDeps) {
  const deps = []
  for (const d of depsOrValueDeps) {
    if (d instanceof Dependency) {
      deps.push(d)
    }
  }
  return deps
}

/**
 * @param {string|Dependency|Symbol} d
 * @returns {Dependency|ValueDependency}
 */
function getDependencyOrValueDependency(d) {
  if (d instanceof Dependency) {
    return d
  } else if (typeof d === "string" || typeof d === "symbol") {
    return new ValueDependency(d)
  } else {
    throw new Error("A function can depend on a dependency or a string/symbol")
  }
}
/**
 * ValueDependency is a fake dependency that is expressed as "string"
 * it throws an error when executed because it should always be passed
 * as parameter
 * @package
 */
class ValueDependency {
  /**
   * @param {string|Symbol} name
   */
  constructor(name) {
    this.id = name
  }
  /**
   * @package
   */
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

/**
 * this wraps a function adding extra features:
 * - dependencies that needs to be executed before in order to execute the function
 * - a way to shut down this function: disable its execution and ensure is no longer running
 */
class Dependency {
  /**
   * Create a dependency object
   * @param {string | undefined} [name] - A description of the dependency
   */
  constructor(name) {
    /**
     * @type {Array<Dependency|ValueDependency>}
     */
    this.edgesAndValues = []
    this.inverseEdges = new Set()

    this.id = this
    this.name = name
    this._func = (/** @type {any} */ ..._args) => {}
    this.contextItems = new Set()
    this.startedFunctions = new Set()

    this.status = new AsyncStatus(DEPENDENCY_STATUS.READY)
  }
  /**
   * Invoked during the execution to get the list of dependencies
   * @package
   * @return {Array<Dependency|ValueDependency>}
   */
  deps() {
    return this.edgesAndValues
  }
  /**
   * Executes the function wrapping it in a promise
   * @package
   * @param {any[]} args
   * @return {Promise<any>}
   */
  async getValue(...args) {
    const status = await this.status.get()
    if (status === DEPENDENCY_STATUS.SHUTDOWN) {
      return Promise.reject(new Error("The dependency is now shutdown"))
    }
    const outputPromise = Promise.resolve().then(() => this._func(...args))
    this.startedFunctions.add(outputPromise)
    return outputPromise
      .then((value) => {
        this.startedFunctions.delete(outputPromise)
        return value
      })
      .catch((err) => {
        this.startedFunctions.delete(outputPromise)
        throw err
      })
  }
  /**
   * Returns type and description of the dependency
   * @return {string}
   */
  toString() {
    return `${this.constructor.name} ${this.name}`
  }
  /**
   * Returns all dependencies, except the parameters
   * @return {Array<Dependency>}
   */
  getEdges() {
    return filterDependency(this.edgesAndValues)
  }
  /**
   * It returns a list with the dependencies connected
   * @return {Array<Dependency>}
   */
  getAdjacencyList() {
    return getAdjacencyList(this)
  }
  /**
   * Returns all dependents
   * @return {Array<Dependency>}
   */
  getInverseEdges() {
    return Array.from(this.inverseEdges)
  }
  /**
   * Run a graph of dependencies in the correct order
   * The dependencies are executed at most once
   * @param {Object} [params]
   * @param {Context} [context]
   * @return {Promise<any>}
   */
  run(params, context) {
    return run(this, params, context)
  }

  /**
   * Dependencies can be listed here
   * A string will be used as parameter that
   * MUST be passed in the run method
   * @param {(Dependency|string|Symbol)[]} deps
   * @return {this}
   */
  dependsOn(...deps) {
    this.edgesAndValues = deps.map(getDependencyOrValueDependency)
    this.getEdges().forEach((d) => {
      d.inverseEdges.add(this)
    })
    return this
  }
  /**
   * Add function that provides the dependency
   * @param {(...args: any[]) => any} func
   * @return {this}
   */
  provides(func) {
    this._func = func
    return this
  }
  /**
   * Shutdown or reset
   * @package
   * @param {string} newStatus
   * @return {Promise<boolean>}
   */
  async _shutdownOrReset(newStatus) {
    const currentStatus = await this.status.get()
    if (newStatus === DEPENDENCY_STATUS.SHUTDOWN) {
      if (currentStatus === DEPENDENCY_STATUS.SHUTDOWN) {
        return Promise.resolve(false)
      }
      // cannot shutdown if some context is still using this dependency
      if (this.contextItems.size !== 0) {
        return Promise.resolve(false)
      }
    }
    return this.status.change(
      newStatus,
      Promise.allSettled(this.startedFunctions).then(() => true)
    )
  }

  /**
   * It shuts down the dependency and returns true if shutdown is executed
   * @return {Promise<boolean>}
   */
  async shutdown() {
    return this._shutdownOrReset(DEPENDENCY_STATUS.SHUTDOWN)
  }
  /**
   * It reset the dependency
   * @return {Promise<boolean>}
   */
  async reset() {
    return this._shutdownOrReset(DEPENDENCY_STATUS.READY)
  }
}

/**
 * This dependency is returned by a function, but its results is memoized and reused.
 * For example a connection to a database.
 */
class ResourceDependency extends Dependency {
  /**
   * Create a ResourceDependency object
   * @param {string | undefined} [name] - A description of the dependency
   */
  constructor(name) {
    super(name)
    this.memo = undefined
    this.stopFunc = () => {}
  }
  /**
   * Execute a dependency and memoizes it
   * @package
   * @param {any[]} args
   * @return {Promise<any>}
   */
  async getValue(...args) {
    if (this.memo != null) {
      return this.memo
    }
    const p = super.getValue(...args).catch((err) => {
      this.memo = undefined
      throw err
    })
    this.memo = p
    return p
  }
  /**
   * Add a function that is used to shutdown the dependency
   * @param {() => any|Promise<any>} func
   * @return {this}
   */
  disposes(func) {
    this.stopFunc = func
    return this
  }
  /**
   * Shutdown or reset
   * @param {string} newStatus
   * @return {Promise<boolean>}
   */
  async _shutdownOrReset(newStatus) {
    const currentStatus = await this.status.get()
    if (newStatus === DEPENDENCY_STATUS.SHUTDOWN) {
      if (currentStatus === DEPENDENCY_STATUS.SHUTDOWN) {
        return Promise.resolve(false)
      }
      // cannot shutdown if some context is still using this dependency
      if (this.contextItems.size !== 0) {
        return Promise.resolve(false)
      }
    }
    // cannot shutdown/reset if this ResourceDependency never started
    if (this.memo == null) {
      return this.status.change(newStatus, Promise.resolve(false))
    }

    this.memo = undefined
    return this.status.change(
      newStatus,
      Promise.allSettled(this.startedFunctions)
        .then(() => this.stopFunc())
        .then(() => true)
    )
  }
}

/**
 * Utility function to convert parameters in a Map
 * @param {Object<string, any>|Map<string|Dependency, any>|Iterable<[string|Dependency, any]>} obj
 */
function paramsToMap(obj) {
  if (obj instanceof Map) {
    return obj // warning: if it is a Map is intentionally mutated!
  }
  if (Array.isArray(obj)) {
    return new Map(obj) // I consider obj to be an array of key value pairs
  }
  if (typeof obj === "object") {
    return new Map(Object.entries(obj))
  }
  throw new Error(
    "Must be either a Map, an array of key/value pairs or an object"
  )
}

/**
 * A context is used to keep track of executed dependencies
 * so that can be shutdown all at once. It also helps observability
 * allowing to keep track of execution and failures
 */
class Context extends EventEmitter {
  /**
   * @param {string | undefined} [name] - A description of the context
   */
  constructor(name) {
    super()
    this.name = name
    this.startedDependencies = new Set()
  }
  /**
   * It returns a list with the dependencies connected
   * @return {Array<Dependency>}
   */
  getAdjacencyList() {
    return getAdjacencyList(Array.from(this.startedDependencies))
  }
  /**
   * @package
   * @param {Dependency} dep
   */
  add(dep) {
    this.startedDependencies.add(dep)
    dep.contextItems.add(this)
  }
  /**
   * @package
   * @param {Dependency} dep
   */
  remove(dep) {
    this.startedDependencies.delete(dep)
    dep.contextItems.delete(this)
  }
  /**
   * You can check if a dependency is part of this context
   * @param {Dependency} dep
   */
  has(dep) {
    return this.startedDependencies.has(dep)
  }
  /**
   * Returns the number of dependencies that are part of this context
   * @return {number}
   */
  size() {
    return this.startedDependencies.size
  }
  /**
   * @package
   * @return {Dependency}
   */
  getFirst() {
    return Array.from(this.startedDependencies)[0]
  }

  /**
   * @package
   * @param {(arg0: Dependency) => Promise<any>} func
   * @return {Promise<void>}
   */
  _execInverse(func) {
    if (this.size() === 0) {
      return Promise.resolve()
    }

    const runFuncOnDep = async (/** @type {Dependency} */ d) => {
      if (!this.has(d)) {
        return
      }
      this.remove(d)
      await Promise.all(d.getInverseEdges().map(runFuncOnDep))
      return func(d)
    }

    return runFuncOnDep(this.getFirst()).then(() => this._execInverse(func))
  }
  /**
   * Shuts down all dependencies that are part of this context in the inverse topological order
   * @return {Promise<void>}
   */
  shutdown() {
    return this._execInverse((d) => {
      const timeStart = performance.now()
      const shutdownPromise = d.shutdown()
      shutdownPromise
        .then((/** @type {boolean} */ hasShutdown) => {
          const info = {
            timeStart,
            timeEnd: performance.now(),
            context: this,
            dependency: d,
          }
          hasShutdown && this.emit(CONTEXT_EVENTS.SUCCESS_SHUTDOWN, info)
        })
        .catch((/** @type {Error} */ error) => {
          const info = {
            timeStart,
            timeEnd: performance.now(),
            context: this,
            dependency: d,
            error,
          }
          this.emit(CONTEXT_EVENTS.FAIL_SHUTDOWN, info)
        })
      return shutdownPromise
    })
  }
  /**
   * reset dependencies that are part of this context in the inverse topological order
   * @return {Promise<void>}
   */
  reset() {
    return this._execInverse((d) => {
      const timeStart = performance.now()
      const resetPromise = d.reset()
      resetPromise
        .then((/** @type {boolean} */ hasReset) => {
          const info = {
            timeStart,
            timeEnd: performance.now(),
            context: this,
            dependency: d,
          }
          hasReset && this.emit(CONTEXT_EVENTS.SUCCESS_RESET, info)
        })
        .catch((/** @type {Error} */ error) => {
          const info = {
            timeStart,
            timeEnd: performance.now(),
            context: this,
            dependency: d,
            error,
          }
          this.emit(CONTEXT_EVENTS.FAIL_RESET, info)
        })
      return resetPromise
    })
  }
}

/**
 * It runs one or more dependencies
 * All the dependencies are executed only once and in the correct order
 * @param {Dependency|string|Symbol|Array<Dependency|string|Symbol>} dep - one or more dependencies
 * @param {Object|Map<string|Dependency|Symbol, any>|Array<[string|Dependency|Symbol, any]>} [params] - parameters. This can also be used to mock a dependency (using a Map)
 * @param {Context | undefined} [context] - Optional context
 * @return {Promise<any>}
 */
function run(dep, params = {}, context) {
  const _cache = paramsToMap(params)
  const id = _cache.get(EXECUTION_ID) ?? crypto.randomUUID()
  _cache.set(EXECUTION_ID, id)

  /** @type Array<any> */
  const timings = []
  const meta = { timings }
  _cache.set(META_DEPENDENCY, meta)

  const getPromiseFromDep = (/** @type {Dependency|ValueDependency} */ dep) => {
    if (context != null && dep instanceof Dependency) {
      context.add(dep)
    }
    return Promise.resolve().then(() => {
      if (!_cache.has(dep.id)) {
        /** @type number */
        let timeStart
        const valuePromise = getPromisesFromDeps(dep.deps()).then((deps) => {
          timeStart = performance.now()
          return dep.getValue(...deps)
        })
        if (context != null) {
          valuePromise
            .then(() => {
              const info = {
                timeStart,
                timeEnd: performance.now(),
                context,
                dependency: dep,
              }
              meta.timings.push(info)
              context.emit(CONTEXT_EVENTS.SUCCESS_RUN, info)
            })
            .catch((error) => {
              const info = {
                timeStart,
                timeEnd: performance.now(),
                context,
                dependency: dep,
                error,
              }
              // no point, the timings won't return
              // timings.push(info)
              context.emit(CONTEXT_EVENTS.FAIL_RUN, info)
            })
        }
        _cache.set(dep.id, valuePromise)
      }
      return _cache.get(dep.id)
    })
  }
  const getPromisesFromDeps = (
    /** @type {(Dependency | ValueDependency)[]} */ deps
  ) => Promise.all(deps.map(getPromiseFromDep))

  return Array.isArray(dep)
    ? getPromisesFromDeps(dep.map(getDependencyOrValueDependency))
    : getPromiseFromDep(getDependencyOrValueDependency(dep))
}

/**
 * It returns a list with the dependencies connected
 * @param {Dependency|Array<Dependency>} dep - one or more dependencies
 * @return {Array<Dependency>}
 */
function getAdjacencyList(dep) {
  const depsQueue = Array.isArray(dep) ? dep : [dep]
  const adjSet = new Set()
  while (depsQueue.length > 0) {
    const dep = depsQueue.pop()
    if (dep == null) break // this is mostly to refine the type
    adjSet.add(dep)
    for (const d of dep.getEdges()) {
      if (!adjSet.has(d)) {
        depsQueue.push(d)
      }
    }
  }
  return Array.from(adjSet)
}

module.exports = {
  Dependency,
  ResourceDependency,
  Context,
  run,
  CONTEXT_EVENTS,
  META_DEPENDENCY,
  EXECUTION_ID,
  getAdjacencyList,
}
