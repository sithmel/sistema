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
