// SPDX-License-Identifier: GPL-3.0-or-later

import { warning } from "./core.js";

class DBError extends Error { }

/** @param {IDBTransaction} transaction */
async function transactionWrapper(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(new DBError("数据库异常", { cause: event.target.error }));
        transaction.onabort = () => reject(new DBError("事务中止", { cause: transaction.error }));
    });
}

function assert(condition, msg) {
    if (!condition) throw new TypeError(msg);
}
function assertString(value, name = "value") {
    assert(typeof value === "string", `${name} 应当为 string 类型，但实际是 ${typeof value}`);
}
function assertNumberOrNull(value, name = "value") {
    assert(value === null || (typeof value === "number" && !Number.isNaN(value)), `${name} 应当为 number | null 类型，但实际是 ${typeof value}`);
}

/** @template T */
class CacheDB {
    /** @param {string} root */
    constructor(root) {
        this.name = root;
        this.storekey = "main";
        this.timestampkey = "timestamp";
        this.db = null;
        this.version = 1;
        this.closed = false;
        this.init = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.name, this.version);
            request.onsuccess = () => {
                this.db = request.result;
                this.db.onclose = () => {
                    warning(`数据库 ${root} 已关闭`);
                    this.closed = true;
                }
                resolve();
            };
            request.onerror = () => {
                reject(new DBError("数据库无法初始化", { cause: request.error }));
            }
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storekey)) {
                    db.createObjectStore(this.storekey);
                }
                if (!db.objectStoreNames.contains(this.timestampkey)) {
                    db.createObjectStore(this.timestampkey);
                }
            };
        });
        // 创建数据库后必须等待 init 完成！
    }
    /**
     * 不检查数据是否过期
     * @param {string} key
     * @returns {Promise<T | undefined>} 
     */
    async get(key) {
        assertString(key, "key");
        try {
            const transaction = this.db.transaction([this.storekey, this.timestampkey], "readonly");
            const store = transaction.objectStore(this.storekey);
            const request = store.get(key);
            await transactionWrapper(transaction);
            return request.result;
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @returns {Promise<number | null | undefined>} 
     */
    async getExpiration(key) {
        assertString(key, "key");
        try {
            const transaction = this.db.transaction(this.timestampkey, "readonly");
            const store = transaction.objectStore(this.timestampkey);
            const request = store.get(key);
            await transactionWrapper(transaction);
            return request.result;
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * 返回缓存是否有效
     * @param {string} key
     * @param {number | null} [t=null]
     * @returns {Promise<boolean>}
     */
    async satisfied(key, t = null) {
        assertString(key, "key");
        assertNumberOrNull(t, "t");
        try {
            const transaction = this.db.transaction([this.timestampkey], "readonly");
            const store = transaction.objectStore(this.timestampkey);
            const request = store.get(key);
            await transactionWrapper(transaction);
            return (request.result === null || request.result > (t ?? Date.now()));
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    async erase(key) {
        assertString(key, "key");
        try {
            const transaction = this.db.transaction([this.storekey, this.timestampkey], "readwrite");
            const store1 = transaction.objectStore(this.timestampkey);
            const store2 = transaction.objectStore(this.storekey);
            store1.delete(key);
            store2.delete(key);
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @param {T} val
     * @param {number | null} expiration
     * @returns {Promise<void>}
     */
    async set(key, val, expiration = null) {
        assertString(key, "key");
        assertNumberOrNull(expiration, "expiration");
        try {
            const transaction = this.db.transaction([this.storekey, this.timestampkey], "readwrite");
            const store1 = transaction.objectStore(this.timestampkey);
            const store2 = transaction.objectStore(this.storekey);
            store1.put(expiration, key);
            store2.put(val, key);
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @param {number | null} expiration
     * @returns {Promise<void>}
     */
    async setExpiration(key, expiration = null) {
        assertString(key, "key");
        assertNumberOrNull(expiration, "expiration");
        try {
            const transaction = this.db.transaction(this.timestampkey, "readwrite");
            const store = transaction.objectStore(this.timestampkey);
            store.put(expiration, key);
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    async expire(key) {
        assertString(key, "key");
        try {
            const transaction = this.db.transaction(this.timestampkey, "readwrite");
            const store = transaction.objectStore(this.timestampkey);
            store.put(0, key);
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /** @returns {Promise<void>} */
    async expireAll() {
        try {
            const transaction = this.db.transaction(this.timestampkey, "readwrite");
            const store = transaction.objectStore(this.timestampkey);
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.update(0);
                    cursor.continue();
                }
            };
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /** @returns {Promise<void>} */
    async clear() {
        try {
            const transaction = this.db.transaction([this.storekey, this.timestampkey], "readwrite");
            const store1 = transaction.objectStore(this.timestampkey);
            const store2 = transaction.objectStore(this.storekey);
            store1.clear();
            store2.clear();
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /** @returns {Promise<string[]>} */
    async keys() {
        try {
            const transaction = this.db.transaction(this.storekey, "readonly");
            const store = transaction.objectStore(this.storekey);
            const request = store.getAllKeys();
            await transactionWrapper(transaction);
            return request.result;
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    close() {
        this.db.close();
    }
}

export { DBError, CacheDB };
