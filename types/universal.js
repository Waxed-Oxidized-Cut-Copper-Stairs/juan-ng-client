// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @typedef {{
 *   luogu: number,
 *   cf?: string | string[],
 *   at?: string | string[],
 *   pri?: number
 * }} Account
 * @typedef {{name: string, accounts: Account[]}} Group
 * @typedef {"lg" | "cf" | "at"} Domain
 */