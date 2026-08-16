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
     * @returns {Promise<number | undefined>} 
     */
    async getExpiration(key) {
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
     * 此函数在不指定 t 时返回 key 是否临期，临期指 10s 内将过期
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async satisfied(key, t) {
        try {
            const transaction = this.db.transaction([this.timestampkey], "readonly");
            const store = transaction.objectStore(this.timestampkey);
            const request = store.get(key);
            await transactionWrapper(transaction);
            console.log("stp", request.result);
            return (request.result === null || request.result > (t ?? Date.now() + 10000));
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    async erase(key) {
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
     * @returns {Promise<void>}
     */
    async set(key, val, expiration = null) {
        try {
            const transaction = this.db.transaction([this.storekey, this.timestampkey], "readwrite");
            const store1 = transaction.objectStore(this.timestampkey);
            const store2 = transaction.objectStore(this.storekey);
            store1.put(expiration, key);
            store2.put(val, key);
            console.log("set", key, expiration);
            await transactionWrapper(transaction);
        } catch (err) {
            throw new DBError("数据库异常", { cause: err });
        }
    }
    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    async setExpiration(key, expiration = null) {
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
        try {
            const transaction = this.db.transaction([this.storekey, this.timestampkey], "readwrite");
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
