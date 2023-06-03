export class Dependency {
    /**
     * @param {?string} name
     */
    constructor(name: string | null);
    edgesAndValues: any[];
    inverseEdges: Set<any>;
    id: this;
    name: string;
    _func: (...args: any[]) => void;
    contextItems: Set<any>;
    /**
     * @return {Array<Dependency|ValueDependency>} name
     */
    deps(): Array<Dependency | ValueDependency>;
    /**
     * @param {any[]} args
     * @return {Promise}
     */
    getValue(...args: any[]): Promise<any>;
    /**
     * @return {string}
     */
    toString(): string;
    /**
     * @return {Array<Dependency>}
     */
    getEdges(): Array<Dependency>;
    /**
     * @return {Array<Dependency>}
     */
    getInverseEdges(): Array<Dependency>;
    /**
     * @param {Object} cache
     * @param {Context} context
     * @return {Promise}
     */
    run(cache: any, context: Context): Promise<any>;
    /**
     * @param {(Dependency|string)[]} deps
     * @return {this}
     */
    dependsOn(...deps: (Dependency | string)[]): this;
    /**
     * @param {() => {}} func
     * @return {this}
     */
    provides(func: () => {}): this;
    /**
     * @return {Promise<boolean>}
     */
    shutdown(): Promise<boolean>;
}
export class SystemDependency extends Dependency {
    memo: Promise<void>;
    /**
     * @param {() => {}} func
     * @return {this}
     */
    dispose(func: () => {}): this;
    stopFunc: () => {};
}
export class Context extends EmptyContext {
    /**
     * @param {?string} name
     */
    constructor(name: string | null);
    name: string;
    startedDependencies: Set<any>;
    /**
     * @typedef {{onStarted:number, error: ?Error}} ExecInfo
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onSuccessRun(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | null;
    }) => void): this;
    /**
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onFailRun(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | null;
    }) => void): this;
    /**
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onSuccessShutdown(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | null;
    }) => void): this;
    /**
     * @param {(arg0: Dependency, arg1: Context, arg2: ExecInfo) => void} func
     * @return {this}
     */
    onFailShutdown(func: (arg0: Dependency, arg1: Context, arg2: {
        onStarted: number;
        error: Error | null;
    }) => void): this;
    /**
     * @param {Dependency} dep
     */
    remove(dep: Dependency): void;
    /**
     * @param {Dependency} dep
     */
    has(dep: Dependency): boolean;
    /**
     * @return {number}
     */
    size(): number;
    /**
     * @return {Dependency}
     */
    getFirst(): Dependency;
    /**
     * @return {Promise}
     */
    shutdown(): Promise<any>;
}
/**
 * @param {Dependency} dep
 * @param {Object|Map<string|Dependency, any>|Array<[string|Dependency, any]>} cache
 * @param {EmptyContext} context
 * @return {Promise}
 */
export function run(dep: Dependency, cache?: any | Map<string | Dependency, any> | Array<[string | Dependency, any]>, context?: EmptyContext): Promise<any>;
declare class ValueDependency {
    /**
     * @param {string} name
     */
    constructor(name: string);
    id: string;
    getValue(): void;
    /**
     * @return {Array<Dependency|ValueDependency>} name
     */
    deps(): Array<Dependency | ValueDependency>;
}
declare class EmptyContext {
    name: any;
    successRun: (dep: any, ctx: any, info: any) => void;
    failRun: (dep: any, ctx: any, info: any) => void;
    successShutdown: (dep: any, ctx: any, info: any) => void;
    failShutdown: (dep: any, ctx: any, info: any) => void;
    /**
     * @param {Dependency} dep
     */
    add(dep: Dependency): void;
}
export {};
//# sourceMappingURL=index.d.ts.map