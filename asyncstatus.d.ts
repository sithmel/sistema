export = AsyncStatus;
/**
 * this object is a very simple async state machine
 * it works as follows:
 * the status (a string) is returned by get (wrapped in a promise)
 * you can change the status using "change" and passing a promise.
 * status changes happen in a queue
 */
declare class AsyncStatus {
    /**
     * @param {string} initialStatus
     */
    constructor(initialStatus: string);
    status: string;
    changingStatus: any;
    /**
     * @return {Promise<string>}
     */
    get(): Promise<string>;
    /**
     * @param {string} newStatus
     * @param {Promise<any>} promise
     * @return {Promise<any>}
     */
    change(newStatus: string, promise: Promise<any>): Promise<any>;
}
//# sourceMappingURL=asyncstatus.d.ts.map