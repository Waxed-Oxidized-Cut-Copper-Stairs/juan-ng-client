/**
 * @typedef {{
 *   type: string,
 *   title: string,
 *   difficulty: number,
 *   pid: string,
 * }} LuoguProblem
 * @typedef {{
 *   pid: string,
 *   type: string,
 *   name: string,
 *   difficulty: string,
 *   submitted: boolean,
 *   accepted: boolean,
 *   tags: number[],
 *   totalSubmit: number,
 *   totalAccepted: number,
 *   flag: number,
 *   provider: LuoguProfile
 * }} LuoguProblemDetail
 */

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   type: number,
 *   provider: {
 *     id: number,
 *     name: string,
 *     isPremium: boolean
 *   },
 *   createTime: number,
 *   deadline: number | null,
 *   problemCount: number,
 *   markCount: number,
 *   marked: boolean,
 *   description: string,
 *   problems: LuoguProblemDetail[]
 * }} LuoguTraining
 */

/**
 * @typedef {{
 *   name: string,
 *   privacy: boolean
 * }} LuoguProfileNew
 * @typedef {{
 *   passed: LuoguProblem[],
 *   submitted: LuoguProblem[],
 *   name: string,
 *   privacy: boolean
 * }} LuoguPracticeNew
 */
