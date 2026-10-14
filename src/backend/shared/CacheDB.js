// SPDX-License-Identifier: GPL-3.0-or-later

/** @template T */
export class CacheDB {
    /** @type {IDBDatabase | null} */
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
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
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
                // @ts-ignore
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.#storekey)) {
                    db.createObjectStore(this.#storekey);
                }
            };
        }));
    }
    /**
     * @param {InternalID} key
     * @param {T} value
     * @returns {Promise<void>}
     */
    async set(key, value) {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#storekey, "readwrite");
            tx.objectStore(this.#storekey).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    /**
     * @overload
     * @param {InternalID} key
     * @returns {Promise<T | undefined>}
     */
    /**
     * @overload
     * @param {InternalID[]} key
     * @returns {Promise<Record<InternalID, T | undefined>>}
     */
    /**
     * @param {InternalID | InternalID[]} key
     * @returns {Promise<T | undefined | Record<InternalID, T | undefined>>}
     */
    async get(key) {
        return new Promise((resolve, reject) => {
            if (!this.#db) {
                reject();
                return;
            }
            const tx = this.#db.transaction(this.#storekey, "readonly");
            if (typeof key === "string") {
                const req = tx.objectStore(this.#storekey).get(key);
                tx.oncomplete = () => resolve(req.result);
            } else {
                const obj = tx.objectStore(this.#storekey);
                /** @type {Record<InternalID, T | undefined>} */
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
