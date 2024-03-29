/**
 * this wraps a function adding extra features:
 * - dependencies that needs to be executed before in order to execute the function
 * - a way to shut down this function: disable its execution and ensure is no longer running
 */
export class Dependency {
    /**
     * Create a dependency object
     * @param {string | undefined} [name] - A description of the dependency
     */
    constructor(name?: string | undefined);
    /**
     * @type {Array<Dependency|ValueDependency>}
     */
    edgesAndValues: Array<Dependency | ValueDependency>;
    inverseEdges: Set<any>;
    id: this;
    name: string | undefined;
    _func: (..._args: any) => void;
    contextItems: Set<any>;
    startedFunctions: Set<any>;
    status: AsyncStatus;
    /**
     * Invoked during the execution to get the list of dependencies
     * @package
     * @return {Array<Dependency|ValueDependency>}
     */
    deps(): Array<Dependency | ValueDependency>;
    /**
     * Executes the function wrapping it in a promise
     * @package
     * @param {any[]} args
     * @return {Promise<any>}
     */
    getValue(...args: any[]): Promise<any>;
    /**
     * Returns type and description of the dependency
     * @return {string}
     */
    toString(): string;
    /**
     * Returns all dependencies, except the parameters
     * @return {Array<Dependency>}
     */
    getEdges(): Array<Dependency>;
    /**
     * It returns a list with the dependencies connected
     * @return {Array<Dependency>}
     */
    getAdjacencyList(): Array<Dependency>;
    /**
     * Returns all dependents
     * @return {Array<Dependency>}
     */
    getInverseEdges(): Array<Dependency>;
    /**
     * Run a graph of dependencies in the correct order
     * The dependencies are executed at most once
     * @param {Object} [params]
     * @param {Context} [context]
     * @return {Promise<any>}
     */
    run(params?: Object | undefined, context?: Context | undefined): Promise<any>;
    /**
     * Dependencies can be listed here
     * A string will be used as parameter that
     * MUST be passed in the run method
     * @param {(Dependency|string|Symbol)[]} deps
     * @return {this}
     */
    dependsOn(...deps: (Dependency | string | Symbol)[]): this;
    /**
     * Add function that provides the dependency
     * @param {(...args: any[]) => any} func
     * @return {this}
     */
    provides(func: (...args: any[]) => any): this;
    /**
     * Shutdown or reset
     * @package
     * @param {string} newStatus
     * @return {Promise<boolean>}
     */
    _shutdownOrReset(newStatus: string): Promise<boolean>;
    /**
     * @package
     * It shuts down the dependency and returns true if shutdown is executed
     * @return {Promise<boolean>}
     */
    _shutdown(): Promise<boolean>;
    /**
     * It reset the dependency
     * @return {Promise<boolean>}
     */
    reset(): Promise<boolean>;
}
/**
 * This dependency is returned by a function, but its results is memoized and reused.
 * For example a connection to a database.
 */
export class ResourceDependency extends Dependency {
    memo: Promise<any> | undefined;
    stopFunc: () => void;
    /**
     * Add a function that is used to shutdown the dependency
     * @param {() => any|Promise<any>} func
     * @return {this}
     */
    disposes(func: () => any | Promise<any>): this;
}
/**
 * A context is used to keep track of executed dependencies
 * so that can be shutdown all at once. It also helps observability
 * allowing to keep track of execution and failures
 */
export class Context extends EventEmitter {
    /**
     * @param {string | undefined} [name] - A description of the context
     */
    constructor(name?: string | undefined);
    name: string | undefined;
    startedDependencies: Set<any>;
    /**
     * It returns a list with the dependencies connected
     * @return {Array<Dependency>}
     */
    getAdjacencyList(): Array<Dependency>;
    /**
     * @package
     * @param {Dependency} dep
     */
    add(dep: Dependency): void;
    /**
     * @package
     * @param {Dependency} dep
     */
    remove(dep: Dependency): void;
    /**
     * You can check if a dependency is part of this context
     * @param {Dependency} dep
     */
    has(dep: Dependency): boolean;
    /**
     * Returns the number of dependencies that are part of this context
     * @return {number}
     */
    size(): number;
    /**
     * @package
     * @return {Dependency}
     */
    getFirst(): Dependency;
    /**
     * @package
     * @param {(arg0: Dependency) => Promise<any>} func
     * @return {Promise<void>}
     */
    _execInverse(func: (arg0: Dependency) => Promise<any>): Promise<void>;
    /**
     * Shuts down all dependencies that are part of this context in the inverse topological order
     * @return {Promise<void>}
     */
    shutdown(): Promise<void>;
    /**
     * reset dependencies that are part of this context in the inverse topological order
     * @return {Promise<void>}
     */
    reset(): Promise<void>;
}
/**
 * It runs one or more dependencies
 * All the dependencies are executed only once and in the correct order
 * @param {Dependency|string|Symbol|Array<Dependency|string|Symbol>} dep - one or more dependencies
 * @param {Object|Map<string|Dependency|Symbol, any>|Array<[string|Dependency|Symbol, any]>} [params] - parameters. This can also be used to mock a dependency (using a Map)
 * @param {Context | undefined} [context] - Optional context
 * @return {Promise<any>}
 */
export function run(dep: Dependency | string | Symbol | Array<Dependency | string | Symbol>, params?: Object | Map<string | Symbol | Dependency, any> | [string | Symbol | Dependency, any][] | undefined, context?: Context | undefined): Promise<any>;
/**
 * Enum context events
 */
export type CONTEXT_EVENTS = string;
export namespace CONTEXT_EVENTS {
    let SUCCESS_RUN: string;
    let FAIL_RUN: string;
    let SUCCESS_SHUTDOWN: string;
    let FAIL_SHUTDOWN: string;
    let SUCCESS_RESET: string;
    let FAIL_RESET: string;
}
export const META_DEPENDENCY: "_meta";
export const EXECUTION_ID: "_executionId";
/**
 * It returns a list with the dependencies connected
 * @param {Dependency|Array<Dependency>} dep - one or more dependencies
 * @return {Array<Dependency>}
 */
export function getAdjacencyList(dep: Dependency | Array<Dependency>): Array<Dependency>;
export const defaultContext: Context;
/**
 * ValueDependency is a fake dependency that is expressed as "string"
 * it throws an error when executed because it should always be passed
 * as parameter
 * @package
 */
declare class ValueDependency {
    /**
     * @param {string|Symbol} name
     */
    constructor(name: string | Symbol);
    id: string | Symbol;
    /**
     * @package
     */
    getValue(): void;
    /**
     * @return {Array<Dependency|ValueDependency>} name
     */
    deps(): Array<Dependency | ValueDependency>;
}
import AsyncStatus = require("./asyncstatus");
import { EventEmitter } from "events";
export {};
//# sourceMappingURL=index.d.ts.map