const DEPENDENCY_ERROR =
  "A function can depend on an array of dependencies or a function returning an array of dependencies"

/*
  this wraps a function adding extra features:
  - dependencies that needs to be executed before in order to execute this
  - a way to shut down this function: disable its execution and ensure is no longer running
*/
class Dependency {
  constructor(deps, func) {
    this.id = this
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

    this._isShuttingDown = false
    this.running = new Set() // keeps track of current executions

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

/*
  Value dependency is a fake dependency that is expressed as "string"
  it throws an error when executed because it should always be passed
  as parameter in the runner
*/
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

/*
  This dependency is returned by a function, but its results is memoized and reused.
  For example a connection to a database. It also has stop method to shutdown gracefully
*/
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

module.exports = { Dependency, SystemDependency, ValueDependency }
