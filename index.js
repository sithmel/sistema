const DEPENDENCY_ERROR =
  "A function can depend on an array of dependencies or a function returning an array of dependencies"

class Executable {
  constructor(name) {
    this._deps = []
    this.id = this
    this.name = name
    this._func = () => {}
  }
  deps() {
    return this._deps
  }
  getValue(...args) {
    return Promise.resolve().then(() => this._func(...args))
  }
  toString() {
    return `${this.constructor.name} ${this.name}`
  }
  getAllDependencies() {
    return this._deps.filter((d) => d instanceof Dependency)
  }

  run(cache = {}) {
    return run(this, cache)
  }
  shutdown() {
    return shutdown(this)
  }
}

/*
  Value dependency is a fake dependency that is expressed as "string"
  it throws an error when executed because it should always be passed
  as parameter in the runner
*/
class ValueDependency extends Executable {
  constructor(name) {
    super(name)
    this.id = name
    this._func = () => {
      throw new Error(`Missing argument: ${name}`)
    }
  }
}

/*
  this wraps a function adding extra features:
  - dependencies that needs to be executed before in order to execute this
  - a way to shut down this function: disable its execution and ensure is no longer running
*/
class Dependency extends Executable {
  dependsOn(deps) {
    if (Array.isArray(deps)) {
      this._deps = deps.map((d) => {
        if (d instanceof Dependency) {
          return d
        } else if (typeof d === "string") {
          return new ValueDependency(d)
        } else {
          throw new Error(DEPENDENCY_ERROR)
        }
      })
    } else {
      throw new Error(DEPENDENCY_ERROR)
    }
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

  deps() {
    if (this.isMemoized) return []
    return super.deps()
  }

  _shutdown() {
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

function run(dep, cache = {}) {
  if (Array.isArray(dep)) {
    const newdep = new Dependency().dependsOn(dep).provides((...args) => args)
    return run(newdep, cache)
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
  const getPromisesFromDeps = (deps) => Promise.all(deps.map(getPromiseFromDep))

  return getPromiseFromDep(dep)
}

function shutdown(dep) {
  if (Array.isArray(dep)) {
    const newdep = new Dependency().dependsOn(dep)
    return shutdown(newdep)
  }

  const alreadyShutdown = new Set()
  const shut = async (d) => {
    if (alreadyShutdown.has(d)) {
      return
    }
    try {
      alreadyShutdown.add(d)
      await d._shutdown()
    } catch (e) {}
    return Promise.all(d.getAllDependencies().map(shut))
  }
  return shut(dep)
}

module.exports = {
  Dependency,
  SystemDependency,
  run,
  shutdown,
}
