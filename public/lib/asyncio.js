// SPDX-License-Identifier: GPL-3.0-or-later

/** @param {number} t */
async function sleep(t) { await new Promise(r => setTimeout(r, t)); }

class Semaphore {
    /** @param {number} count */
    constructor(count) {
        /** @type {number} */
        this.count = count;
        /** @type {Function[]} */
        this.queue = [];
    }
    acquire() {
        if (this.count > 0) {
            --this.count;
            return Promise.resolve();
        }
        return new Promise(resolve => { this.queue.push(resolve); });
    }
    release() {
        if (this.queue.length > 0) this.queue.shift()();
        else ++this.count;
    }
}

class Lock {
    constructor() {
        this.busy = false;
        /** @type {Function[]} */
        this.queue = [];
    }
    acquire() {
        if (!this.busy) {
            this.busy = true;
            return Promise.resolve();
        }
        return new Promise(resolve => { this.queue.push(resolve); });
    }
    release() {
        if (this.queue.length > 0) this.queue.shift()();
        else this.busy = false;
    }
}

export { sleep, Semaphore, Lock };
