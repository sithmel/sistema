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
    edgesAndValues: any[];
    inverseEdges: Set<any>;
    id: this;
    name: string;
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
     * @return {Promise}
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
     * Returns all dependents
     * @return {Array<Dependency>}
     */
    getInverseEdges(): Array<Dependency>;
    /**
     * Run a graph of dependencies in the correct order
     * The dependencies are executed at most once
     * @param {Object} [params]
     * @param {Context} [context]
     * @return {Promise}
     */
    run(params?: any, context?: Context): Promise<any>;
    /**
     * Dependencies can be listed here
     * A string will be used as parameter that
     * MUST be passed in the run method
     * @param {(Dependency|string)[]} deps
     * @return {this}
     */
    dependsOn(...deps: (Dependency | string)[]): this;
    /**
     * Add function that provides the dependency
     * @param {() => any} func
     * @return {this}
     */
    provides(func: () => any): this;
    /**
     * Shutdown or reset
     * @package
     * @param {string} newStatus
     * @return {Promise}
     */
    _shutdownOrReset(newStatus: string): Promise<any>;
    /**
     * It shuts down the dependency and returns true if shutdown is executed
     * @return {Promise<boolean>}
     */
    shutdown(): Promise<boolean>;
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
    memo: Promise<any>;
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
export class Context {
    /**
     * @param {string | undefined} [name] - A description of the context
     */
    constructor(name?: string | undefined);
    name: string;
    startedDependencies: Set<any>;
    successRun: (_dep: any, _ctx: any, _info: any) => void;
    failRun: (_dep: any, _ctx: any, _info: any) => void;
    successShutdown: (_dep: any, _ctx: any, _info: any) => void;
    failShutdown: (_dep: any, _ctx: any, _info: any) => void;
    successReset: (_dep: any, _ctx: any, _info: any) => void;
    failReset: (_dep: any, _ctx: any, _info: any) => void;
    /**
     * Adds a function that runs whenever a dependency is successfully executed
     * @typedef {{onStarted:number, error: Error|undefined}} ExecInfo
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onSuccessRun(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | undefined;
    }) => void): this;
    /**
     * Adds a function that runs whenever a dependency throws an exception
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onFailRun(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | undefined;
    }) => void): this;
    /**
     * Adds a function that runs whenever a dependency is successfully shutdown
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onSuccessShutdown(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | undefined;
    }) => void): this;
    /**
     * Adds a function that runs whenever a dependency fails to shutdown
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onFailShutdown(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | undefined;
    }) => void): this;
    /**
     * Adds a function that runs whenever a dependency is successfully reset
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onSuccessReset(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | undefined;
    }) => void): this;
    /**
     * Adds a function that runs whenever a dependency fails to reset
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onFailReset(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | undefined;
    }) => void): this;
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
     * @param {(arg0: Dependency) => Promise} func
     */
    _execInverse(func: (arg0: Dependency) => Promise<any>): any;
    /**
     * Shuts down all dependencies that are part of this context in the inverse topological order
     * @return {Promise}
     */
    shutdown(): Promise<any>;
    /**
     * reset dependencies that are part of this context in the inverse topological order
     * @return {Promise}
     */
    reset(): Promise<any>;
}
/**
 * It runs one or more dependencies
 * All the dependencies are executed only once and in the correct order
 * @param {Dependency|Array<Dependency>} dep - one or more dependencies
 * @param {Object|Map<string|Dependency, any>|Array<[string|Dependency, any]>} [params] - parameters. This can also be used to mock a dependency (using a Map)
 * @param {Context | undefined} [context] - Optional context
 * @return {Promise}
 */
export function run(dep: Dependency | Array<Dependency>, params?: any | Map<string | Dependency, any> | Array<[string | Dependency, any]>, context?: Context | undefined): Promise<any>;
import AsyncStatus = require("./asyncstatus");
/**
 * ValueDependency is a fake dependency that is expressed as "string"
 * it throws an error when executed because it should always be passed
 * as parameter
 * @package
 */
declare class ValueDependency {
    /**
     * @param {string} name
     */
    constructor(name: string);
    id: string;
    /**
     * @package
     */
    getValue(): void;
    /**
     * @return {Array<Dependency|ValueDependency>} name
     */
    deps(): Array<Dependency | ValueDependency>;
}
export {};
//# sourceMappingURL=index.d.ts.map