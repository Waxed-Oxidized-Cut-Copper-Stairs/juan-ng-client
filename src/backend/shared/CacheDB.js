// SPDX-License-Identifier: GPL-3.0-or-later

/** @template T */
export class CacheDB {
    /** @type {IDBDatabase} */
    #db;
    #root;
    #storekey;
    /** @param {string} root */
    constructor(root) {
        this.#db = null;
        this.#root = root;
        this.#storekey = "main";
    }
    async init() {
        if (this.#db !== null) return;
        await new Promise((resolve, reject) => {
            const req = indexedDB.open(this.#root, 1);
            req.onsuccess = () => {
                this.#db = req.result;
                this.#db.onclose = () => {
                    this.#db = null;
                };
                resolve();
            };
            req.onerror = () => {
                reject(new Error("[CacheDB.init] Initalization failed.", { cause: req.error }));
            };
            req.onupgradeneeded = (event) => {
                /** @type {IDBDatabase} */
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storekey)) {
                    db.createObjectStore(this.#storekey);
                }
            };
        });
    }
    /**
     * @param {string} key
     * @param {T} value
     */
    async set(key, value) {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            tx.objectStore(this.#storekey).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * @overload
     * @param {string} key
     * @returns {Promise<T | undefined>}
     */
    /**
     * @overload
     * @param {string[]} key
     * @returns {Promise<Record<string, T | undefined>>}
     */
    /**
     * @param {string | string[]} key
     * @returns {Promise<T | undefined | Record<string, T | undefined>>}
     */
    async get(key) {
        return new Promise((resolve, reject) => {
            const tx = this.#db.transaction(this.#storekey, "readonly");
            if (typeof key === "string") {
                const req = tx.objectStore(this.#storekey).get(key);
                tx.oncomplete = () => resolve(req.result);
            } else {
                const obj = tx.objectStore(this.#storekey);
                const result = {};
                for (const x of key) {
                    const req = obj.get(x);
                    req.onsuccess = () => { result[x] = req.result; };
                }
                tx.oncomplete = () => resolve(result);
            }
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
}
