// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @typedef {{
 *   luogu: number,
 *   cf?: string | string[],
 *   at?: string | string[],
 *   pri?: number,
 *   star?: boolean
 * }} Account
 * @typedef {{name: string, accounts: Account[]}} Group
 * @typedef {"lg" | "cf" | "at"} Domain
 */

/**
 * @typedef {{
 *   passed: Map<number, [string, string | number]>,
 *   submitted: Map<number, [string, string | number]>
 * }} Origin
 */

/**
 * @typedef {{
 *   luogu: {
 *     count: number,
 *     crawled: number,
 *     outdated: number[]
 *   },
 *   codeforces: {
 *     count: number,
 *     crawled: number
 *   },
 *   atcoder: {
 *     count: number,
 *     crawled: number
 *   }
 * }} DBOutline
 */