/**
 * @typedef {"lg" | "at" | "cf" | "uoj" | "qoj"} Platform
 * @typedef {{
 *   id: string,
 *   platform: Platform,
 *   uid: string,
 *   name?: string,
 *   last_updated?: number | null,
 *   expire_at?: number | null
 * }} Account
 * @typedef {{
 *   id: string,
 *   accounts: string[],
 *   display_name: {
 *     type: ("follow" | "fixed"),
 *     value: string
 *   }
 * }} User
 * @typedef {{
 *   id: string,
 *   name: string,
 *   members: string[]
 * }} Group
 */