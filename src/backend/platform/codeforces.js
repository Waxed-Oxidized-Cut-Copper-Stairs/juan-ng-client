// SPDX-License-Identifier: GPL-3.0-or-later

import { CacheDB } from "../shared/CacheDB";
import { MainloopFrame } from "../shared/MainloopFrame";

/** @param {CodeForcesProblemBrief} prob */
function parsePid(prob) { return `CF${prob.contestId}${prob.index}`; }

/** @type {CacheDB<CodeForcesPractice>} */
const db = new CacheDB("codeforces");

/**
 * @param {Account} account
 * @param {Response} resp
 */
async function handler(account, resp) {
    const data = await resp.json();
    if (!data) return;
    /** @type {CodeForcesSubmission[]} */
    const submissions = data.result;
    if (!Array.isArray(submissions)) {
        throw TypeError(`[codeforces.handler] submission list is not an array.`);
    }
    /** @type {Map<string, CodeForcesProblemBrief>} */
    const passed = new Map();
    /** @type {Map<string, CodeForcesProblemBrief>} */
    const submitted = new Map();
    for (const submission of submissions) {
        // 假定存在 contestId
        const contestId = submission.problem.contestId;
        const index = submission.problem.index;
        const name = submission.problem.name;
        const verdict = submission.verdict;
        const prob = { contestId, index, name };
        if (verdict === "OK") {
            passed.set(parsePid(prob), prob);
        } else {
            submitted.set(parsePid(prob), prob);
        }
    }
    /** @type {CodeForcesPractice} */
    const ret = {
        passed: Array.from(passed.values()),
        submitted: Array.from(submitted.values())
    };
    await db.init();
    await db.set(account.uid, ret);
    return account;
}

const loop = new MainloopFrame("cf", (account) => `https://codeforces.com/api/user.status?handle=${account.uid}&lang=en`, handler);

export async function mainloop() {
    loop.mainloop();
}

/**
 * @typedef {{
 *   handle: string,
 *   name?: string
 * }} CodeForcesMember
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
