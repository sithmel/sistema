const AdjacencyListUtils = require("./AdjacencyListUtils")
const { Dependency } = require("./dependency")

const TERMINATE_DEFAULTS = {
  exitDelay: 50,
  stopWindow: 5000,
  onAfterTerminate: () => {},
  onBeforeTerminate: () => {},
  onErrorTerminate: () => {},
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

class Runner {
  constructor(onTerminateOptions) {
    this.startedDependencies = new Set()
    this.onTerminate(onTerminateOptions)
  }

  run(dep, cache = {}) {
    const _cache = cacheToMap(cache)

    const getPromiseFromDep = (dep) => {
      if (dep instanceof Dependency) {
        this.startedDependencies.add(dep)
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
    const getPromisesFromDeps = (deps) =>
      Promise.all(deps.map(getPromiseFromDep))

    return getPromiseFromDep(dep)
  }

  shutdown() {
    if (this.startedDependencies.size === 0) {
      return Promise.resolve()
    }

    const adj = new AdjacencyListUtils(Array.from(this.startedDependencies))

    // if all nodes of the graph have at least a dependency, there is no way to
    // stop the dependencies in the right order (there are cycles)
    if (adj.emptyDeps.size === 0 && adj.adjacencyList.size !== 0) {
      throw new Error(
        "The dependency graph is not a DAC (directed acyclic graph)"
      )
    }

    const shutDownDep = async (d) => {
      if (!this.startedDependencies.has(d)) {
        // this dep is already being stopped, return a fulfilled Promise
        return
      }
      this.startedDependencies.delete(d)
      // shutdown a dependency and return a promise if there are others
      await d.shutdown()
      adj.deleteFromInverseAdjacencyList(d)
      return Promise.all(Array.from(adj.emptyDeps).map(shutDownDep))
    }
    return Promise.all(Array.from(adj.emptyDeps).map(shutDownDep))
  }

  onTerminate(options) {
    const {
      onAfterTerminate,
      onBeforeTerminate,
      onErrorTerminate,
      customEvent,
      handleExceptions,
      stopWindow,
      exitDelay,
    } = {
      ...TERMINATE_DEFAULTS,
      ...options,
    }

    function shutDown(reason, code) {
      if (code != null) {
        process.exitCode = code
      }

      if (customEvent) {
        process.removeListener(customEvent, stopListener)
      }
      process.removeListener("SIGINT", sigintListener)
      process.removeListener("SIGTERM", sigtermListener)
      if (handleExceptions) {
        process.removeListener("uncaughtException", uncaughtExceptionListener)
        process.removeListener("unhandledRejection", unhandledRejectionListener)
      }

      const timeoutFunction = timeoutMessage(
        stopWindow,
        `Graceful shutdown took more than stop window (${stopWindow} ms). Terminating process.`
      )

      return Promise.resolve()
        .then(onBeforeTerminate)
        .then(() => Promise.race([this.shutdown(reason), timeoutFunction]))
        .then((message) => {
          Promise.resolve()
            .then(() => onAfterTerminate(message))
            .then(() => exitSoon(code))
            .catch(() => exitSoon(code))
        })
        .catch((err) => {
          Promise.resolve()
            .then(() => onErrorTerminate(err))
            .then(() => exitSoon(1))
            .catch(() => exitSoon(1))
        })
    }

    function exitSoon(code) {
      setTimeout(() => process.exit(code), exitDelay).unref()
    }

    const stopListener = (payload) =>
      shutDown(`'${customEvent}'`, payload && payload.code)
    const sigintListener = () => shutDown("SIGINT")
    const sigtermListener = () => shutDown("SIGINT")

    const uncaughtExceptionListener = (err) => {
      console.error(err)
      shutDown("uncaughtException", 1)
    }
    const unhandledRejectionListener = (err) => {
      console.error(err)
      shutDown("unhandledRejection", 1)
    }

    if (customEvent) {
      process.once(customEvent, stopListener)
    }
    process.once("SIGINT", sigintListener)
    process.once("SIGTERM", sigtermListener)
    if (handleExceptions) {
      process.once("uncaughtException", uncaughtExceptionListener)
      process.once("unhandledRejection", unhandledRejectionListener)
    }
  }
}

module.exports = Runner
