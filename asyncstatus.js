//@ts-check

/**
 * this object is a very simple async state machine
 * it works as follows:
 * the status (a string) is returned by get (wrapped in a promise)
 * you can change the status using "change" and passing a promise.
 * status changes happen in a queue
 */
class AsyncStatus {
  /**
   * @param {string} initialStatus
   */
  constructor(initialStatus) {
    this.status = initialStatus
    this.changingStatus = undefined
  }
  /**
   * @return {Promise<string>}
   */
  async get() {
    if (this.changingStatus) {
      await this.changingStatus
    }
    return this.status
  }
  /**
   * @param {string} newStatus
   * @param {Promise} promise
   * @return {Promise}
   */
  change(newStatus, promise) {
    this.status = ""
    this.changingStatus = this.get().then(() => {
      return promise
        .then(() => {
          this.changingStatus = undefined
          this.status = newStatus
        })
        .catch(() => {
          this.changingStatus = undefined
          this.status = newStatus
        })
    })
    return promise
  }
}

module.exports = AsyncStatus
