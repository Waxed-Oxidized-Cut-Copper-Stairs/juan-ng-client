// SPDX-License-Identifier: GPL-3.0-or-later

/** @param {number} t */
export async function sleep(t) { await new Promise(r => setTimeout(r, t)); }

export class SeizeLock {
    #busy;
    #q1;
    #q2;
    constructor() {
        this.#busy = false;
        this.#q1 = [];
        this.#q2 = [];
    }
    async acquire() {
        if (!this.#busy) {
            this.#busy = true;
            return Promise.resolve();
        }
        return new Promise(resolve => { this.#q1.push(resolve); });
    }
    async seize() {
        if (!this.#busy) {
            this.#busy = true;
            return Promise.resolve();
        }
        return new Promise(resolve => { this.#q2.push(resolve); });
    }
    release() {
        if (this.#q2.length > 0) this.#q2.shift()();
        else if (this.#q1.length > 0) this.#q1.shift()();
        else this.#busy = false;
    }
}
