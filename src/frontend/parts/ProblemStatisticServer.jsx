// SPDX-License-Identifier: GPL-3.0-or-later

import { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { subscribe } from "../bus";
import { queryPid } from "../protocol";

/**
 * @param {Object} options
 * @param {PID} options.pid
 */
export function ProblemStatisticServer({ children, pid, ...rest }) {
    /** @type {UseState<Set<InternalID>>} */
    const [passed, setPassed] = useState(new Set());
    /** @type {UseState<Set<InternalID>>} */
    const [submitted, setSubmitted] = useState(new Set());
    const update = useCallback(async () => {
        const { passed: newPassed, submitted: newSubmitted } = await queryPid(pid);
        setPassed(new Set(newPassed));
        setSubmitted(new Set(newSubmitted));
    }, []);
    useEffect(() => {
        update();
        const abort = new AbortController();
        document.addEventListener("visibilitychange", () => {
            update();
        }, { signal: abort.signal });
        const unload = subscribe("problem", () => update());
        return () => {
            abort.abort();
            unload();
        }
    }, [update]);
    if (!isValidElement(children)) throw new Error("ProblemStatisticServer should have only one child.");
    return cloneElement(children, { pid, passed, submitted, ...rest });
}