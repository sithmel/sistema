//@ts-check

/**
 * ValueDependency is a fake dependency that is expressed as "string"
 * it throws an error when executed because it should always be passed
 * as parameter
 * @package
 */
class ValueDependency {
  /**
   * @param {string} name
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
    this.edgesAndValues = []
    this.inverseEdges = new Set()

    this.id = this
    this.name = name
    this._func = (/** @type {any} */ ..._args) => {}
    this.contextItems = new Set()
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
   * @return {Promise}
   */
  getValue(...args) {
    return Promise.resolve(this._func(...args))
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
    return this.edgesAndValues.filter((d) => d instanceof Dependency)
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
   * @return {Promise}
   */
  run(params = {}, context) {
    return run(this, params, context)
  }

  /**
   * Dependencies can be listed here
   * A string will be used as parameter that
   * MUST be passed in the run method
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
   * Add function that provides the dependency
   * @param {() => any} func
   * @return {this}
   */
  provides(func) {
    this._func = func
    return this
  }
  /**
   * It shuts down the dependency and returns true if shutdown is executed
   * @return {Promise<boolean>}
   */
  shutdown() {
    return Promise.resolve(false)
  }
}

/**
 * This dependency is returned by a function, but its results is memoized and reused.
 * For example a connection to a database.
 */
class SystemDependency extends Dependency {
  /**
   * Create a SystemDependency object
   * @param {string | undefined} [name] - A description of the dependency
   */
  constructor(name) {
    super(name)
    this.memo = undefined
  }
  /**
   * Execute a dependency and memoizes it
   * @package
   * @param {any[]} args
   * @return {Promise<any>}
   */
  getValue(...args) {
    if (this.memo != null) {
      return this.memo
    }
    const p = Promise.resolve(this._func(...args)).catch((err) => {
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
  dispose(func) {
    this.stopFunc = func
    return this
  }

  /**
   * It shuts down the dependency and returns true if shutdown is executed
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
 * Utility function to convert parameters in a Map
 * @param {Object<string, any>|Map<string|Dependency, any>|Iterable<string|Dependency, any>} obj
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
class Context {
  /**
   * @param {string | undefined} [name] - A description of the context
   */
  constructor(name) {
    this.name = name
    this.startedDependencies = new Set()

    this.successRun =
      this.failRun =
      this.successShutdown =
      this.failShutdown =
        (
          /** @type {any} */ _dep,
          /** @type {any} */ _ctx,
          /** @type {any} */ _info
        ) => {}
  }
  /**
   * Adds a function that runs whenever a dependency is successfully executed
   * @typedef {{onStarted:number, error: Error|undefined}} ExecInfo
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onSuccessRun(func) {
    this.successRun = func
    return this
  }
  /**
   * Adds a function that runs whenever a dependency throws an exception
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onFailRun(func) {
    this.failRun = func
    return this
  }
  /**
   * Adds a function that runs whenever a dependency is successfully shutdown
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onSuccessShutdown(func) {
    this.successShutdown = func
    return this
  }
  /**
   * Adds a function that runs whenever a dependency fails to shutdown
   * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
   * @return {this}
   */
  onFailShutdown(func) {
    this.failShutdown = func
    return this
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
   * Shuts down all dependencies that are part of this context in the inverse topological order
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
 * It runs one or more dependencies
 * All the dependencies are executed only once and in the correct order
 * @param {Dependency|Array<Dependency>} dep - one or more dependencies
 * @param {Object|Map<string|Dependency, any>|Array<[string|Dependency, any]>} [params] - parameters. This can also be used to mock a dependency (using a Map)
 * @param {Context | undefined} [context] - Optional context
 * @return {Promise}
 */
function run(dep, params = {}, context) {
  const _cache = paramsToMap(params)

  const getPromiseFromDep = (dep) => {
    if (context != null && dep instanceof Dependency) {
      context.add(dep)
    }
    return Promise.resolve().then(() => {
      if (!_cache.has(dep.id)) {
        let startedOn
        const valuePromise = getPromisesFromDeps(dep.deps()).then((deps) => {
          startedOn = Date.now()
          return dep.getValue(...deps)
        })
        if (context != null) {
          valuePromise
            .then(() => context.successRun(dep, context, { startedOn }))
            .catch((error) => {
              context.failRun(dep, context, { error, startedOn })
            })
        }
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
