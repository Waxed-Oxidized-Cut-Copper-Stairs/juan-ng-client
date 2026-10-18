// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from "react";
import { fmtTimeStamp } from "../../shared/fmt";
import { format } from "date-fns";
import styles from "./TimeLabel.module.css";

/**
 * @param {Object} options
 * @param {number} options.ms
 */
export function TimeLabel({ ms }) {
    const [raw, setRaw] = useState(false);
    return (
        <span
            className={styles.main}
            onMouseEnter={() => setRaw(true)}
            onMouseLeave={() => setRaw(false)}>
            {fmtTimeStamp(ms)}
            {raw && (
                <div className={styles.float}>
                    <span>
                        {format(new Date(ms), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                </div>
            )}
        </span>
    )
}
