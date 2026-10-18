// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @typedef {"lg" | "at" | "cf" | "uoj" | "qoj"} Platform
 * @typedef {{
 *   id: InternalID,
 *   platform: Platform,
 *   uid: string,
 *   name?: string,
 *   last_updated?: number | null,
 *   expire_at?: number | null
 * }} Account
 * @typedef {{
 *   id: InternalID,
 *   accounts: InternalID[],
 *   display_name: {
 *     type: ("follow" | "fixed"),
 *     value: string
 *   }
 * }} User
 * @typedef {{
 *   id: InternalID,
 *   name: string,
 *   members: InternalID[]
 * }} Group
 */

/**
 * @typedef {string & {__brand_name: "PID"}} PID
 * @typedef {string & {__brand_name: "InternalID"}} InternalID
 * @typedef {string & {__brand_name: "DisplayID"}} DisplayID
 * @typedef {{
 *   passed: InternalID[],
 *   submitted: InternalID[]
 * }} ProblemRecord
 */

/**
 * @template T
 * @typedef {[T, import("react").Dispatch<import("react").SetStateAction<T>>]} UseState
 */
