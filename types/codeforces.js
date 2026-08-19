// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * @typedef {{
 *   handle: string,
 *   name?: string
 * }} CodeForcesMember
 */

/**
 * @typedef {{
 *   contestId?: number,
 *   problemsetName?: string,
 *   index: string,
 *   name: string,
 *   type: "PROGRAMMING" | "QUESTION",
 *   points?: number,
 *   rating?: number,
 *   tags: string[]
 * }} CodeForcesProblem
 */

/**
 * @typedef {{
 *   contestId?: number,
 *   members: CodeForcesMember[],
 *   participantType: string,
 *   teamId?: number,
 *   teamName?: string,
 *   ghost: boolean,
 *   room?: number,
 *   startTimeSeconds?: number
 * }} CodeForcesParty
 */

/**
 * @typedef {{
 *   id: number,
 *   contestId?: number,
 *   creationTimeSeconds: number,
 *   relativeTimeSeconds: number,
 *   problem: CodeForcesProblem,
 *   author: CodeForcesParty,
 *   programmingLanguage: string,
 *   verdict?: string,
 *   testset: string,
 *   passedTestCount: number,
 *   timeConsumedMillis: number,
 *   memoryConsumedBytes: number,
 *   points?: number
 * }} CodeForcesSubmission
 */

/**
 * Represents a contest on Codeforces.
 * @typedef {{
 *   id: number,
 *   name: string,
 *   type: "CF" | "IOI" | "ICPC",
 *   phase: string,
 *   frozen: boolean,
 *   durationSeconds: number,
 *   freezeDurationSeconds?: number,
 *   startTimeSeconds?: number,
 *   relativeTimeSeconds?: number,
 *   preparedBy?: string,
 *   websiteUrl?: string,
 *   description?: string,
 *   difficulty?: number,
 *   kind?: string,
 *   icpcRegion?: string,
 *   country?: string,
 *   city?: string,
 *   season?: string
 * }} CodeForcesContest
 */

/**
 * @typedef {{
 *   contestId?: string,
 *   index: string,
 *   name: string
 * }} CodeForcesProblemBrief
 * @typedef {{
 *   passed: CodeForcesProblemBrief[],
 *   submitted: CodeForcesProblemBrief[],
 *   lastUpdate: number
 * }} CodeForcesPractice
 */
