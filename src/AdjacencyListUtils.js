/*
This is an utility class used by the shutdown process
It builds an adjacency list and its inverse and use it for:
- keeping track of items with no dependencies
- remove them
*/
class AdjacencyListUtils {
  constructor(dependencies) {
    // build adjacency list and inverse adjacency list
    this.adjacencyList = new Map()
    this.inverseAdjacencyList = new Map() // adjacency list with reversed edges
    this.emptyDeps = new Set()

    // build adjacencyList and initialise inverse
    // this is recursive so it includes dependencies
    // that are not included in the 'dependencies' argument
    const addNewDep = (d) => {
      if (this.adjacencyList.has(d)) {
        return
      }
      const deps = d.getAllDependencies()
      this.adjacencyList.set(d, new Set(deps))
      this.inverseAdjacencyList.set(d, new Set())
      deps.forEach(addNewDep)
    }
    dependencies.forEach(addNewDep)

    // complete inverseAdjacencyList
    Array.from(this.adjacencyList.keys()).forEach((d) => {
      const deps = this.adjacencyList.get(d)
      deps.forEach((dep) => {
        this.inverseAdjacencyList.get(dep).add(d)
      })
    })

    // prepare a set of empty inverse dependencies
    this.emptyDeps = new Set(
      Array.from(this.inverseAdjacencyList.entries())
        .filter(([_id, deps]) => deps.size === 0)
        .map(([id, _deps]) => id)
    )
  }

  // removes a dependency and returns all dependencies with no dependencies
  deleteFromInverseAdjacencyList(d) {
    if (
      !this.inverseAdjacencyList.has(d) ||
      this.inverseAdjacencyList.get(d).size !== 0
    ) {
      throw new Error("This dependency cannot be removed")
    }
    // remove the dependency in the inverse dependency list O(1)
    this.inverseAdjacencyList.delete(d)
    // remove the dependency from the set with the help of the adjacency list
    Array.from(this.adjacencyList.get(d)).forEach((dep) => {
      const deps = this.inverseAdjacencyList.get(dep)
      deps.delete(d)
      if (deps.size === 0) {
        this.emptyDeps.add(dep)
      }
    })
    this.adjacencyList.delete(d)
    this.emptyDeps.delete(d)
  }
}

module.exports = AdjacencyListUtils
