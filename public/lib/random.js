class mt19937 {
    static N = 624;
    constructor(seed = Date.now()) {
        this.mt = new Uint32Array(mt19937.N);
        this.mti = mt19937.N;
        this.mt[0] = seed >>> 0;
        const mul = BigInt(1812433253);
        for (let i = 1; i < mt19937.N; ++i) {
            const value = BigInt(this.mt[i - 1] ^ (this.mt[i - 1] >>> 30));
            this.mt[i] = Number((mul * value + BigInt(i)) & 0xFFFFFFFFn);
        }
    }
    #twist() {
        for (let i = 0; i < mt19937.N; ++i) {
            let y = (this.mt[i] & 0x80000000) |
                (this.mt[(i + 1) % mt19937.N] & 0x7fffffff);
            let mag = (y & 1) ? 0x9908b0df : 0;
            this.mt[i] = this.mt[(i + 397) % mt19937.N] ^ (y >>> 1) ^ mag;
        }
        this.mti = 0;
    }
    /**
     * 随机生成 32 位无符号整数
     * @returns {number}
     */
    rand() {
        if (this.mti >= mt19937.N) this.#twist();
        let y = this.mt[this.mti++];
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);
        return y >>> 0;
    }
}

const rnd = new mt19937();

/**
 * 生成长为 n 的十六进制串
 * @param {number} n
 */
function randhex(n) {
    const ret = [];
    while (n > 0) {
        const x = rnd.rand();
        let m = Math.min(n, 8);
        n -= m;
        m <<= 2;
        for (let j = 0; j < m; j += 4) {
            ret.push("0123456789abcdef"[(x >> j) & 0xf]);
        }
    }
    return ret.join("");
}
/**
 * @param {number} l
 * @param {number} r
 */
function randint(l, r) {
    return Math.floor(Math.random() * (r - l + 1)) + l;
}
/** @param {Array} arr */
function shuffle(arr) {
    for (let i = arr.length - 1; ~i; --i) {
        const j = randint(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

export { mt19937, randhex, randint, shuffle };
