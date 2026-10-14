// SPDX-License-Identifier: GPL-3.0-or-later

import { CacheDB } from "../shared/CacheDB";
import { accountsDB } from "../shared/ItemDB";
import { MainloopFrame } from "../shared/MainloopFrame";

/** @param {CodeForcesProblemBrief} prob */
function parsePid(prob) { return `CF${prob.contestId}${prob.index}`; }

/** @type {CacheDB<CodeForcesPractice>} */
const db = new CacheDB("codeforces");

/** @type {Map<string, CodeForcesProblem[]>} */
const problemset = new Map();
/** @param {Response} resp */
async function handleProblemset(resp) {
    const data = await resp.json();
    if (!data) return;
    /** @type {CodeForcesProblem[]} */
    const problems = data.result.problems;
    problemset.clear();
    for (const prob of problems) {
        if (!problemset.has(prob.name)) {
            problemset.set(prob.name, []);
        }
        problemset.get(prob.name).push(prob);
    }
    updateAll();
}
/** @param {CodeForcesProblemBrief} prob */
function parseProblemset(prob) {
    const a = problemset.get(prob.name);
    if (!a) return parsePid(prob);
    for (const p of a) {
        if (Math.abs(p.contestId - prob.contestId) <= 1) return parsePid(p);
    }
    return parsePid(prob);
}

async function getAccounts() {
    return (await accountsDB.getAll()).filter((account) => account.platform === "cf");
}

/** @type {Map<string, Set<string>>} */
const passedMap = new Map();
/** @type {Map<string, Set<string>>} */
const submittedMap = new Map();
/**
 * @param {string} id
 * @param {CodeForcesPractice} record
 */
function update(id, record) {
    const { passed, submitted } = record;
    for (const prob of submitted) {
        const pid = parseProblemset(prob);
        if (!submittedMap.has(pid)) submittedMap.set(pid, new Set());
        if (!passedMap.has(pid) || !passedMap.get(pid).has(id)) {
            submittedMap.get(pid).add(id);
        }
    }
    for (const prob of passed) {
        const pid = parseProblemset(prob);
        if (!passedMap.has(pid)) passedMap.set(pid, new Set());
        if (submittedMap.has(pid)) submittedMap.get(pid).delete(id);
        passedMap.get(pid).add(id);
    }
}
async function updateAll() {
    const accounts = (await getAccounts());
    const records = await db.get(accounts.map((account) => account.uid));
    for (const account of accounts) {
        const record = records[account.uid];
        if (record) update(account.id, record);
    }
}

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
    update(account.id, ret);
    await db.init();
    await db.set(account.uid, ret);
    return account;
}

const loop = new MainloopFrame("cf", (account) => `https://codeforces.com/api/user.status?handle=${account.uid}&lang=en`, handler);
loop.seize("https://codeforces.com/api/problemset.problems", handleProblemset);

export async function mainloop() {
    loop.mainloop();
}

/** @param {string} pid */
export async function queryPid(pid) {
    const passed = passedMap.get(pid);
    const submitted = submittedMap.get(pid);
    return {
        passed: passed ? Array.from(passed) : [],
        submitted: submitted ? Array.from(submitted) : []
    };
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
 *   submitted: CodeForcesProblemBrief[]
 * }} CodeForcesPractice
 */
