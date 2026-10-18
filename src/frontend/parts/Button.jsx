// SPDX-License-Identifier: GPL-3.0-or-later

import { mergeClassName } from "../toolkit";
import styles from "./Button.module.css";

export function Button({ children, onClick, className, ...rest }) {
    return (
        <button onClick={onClick} className={mergeClassName(styles.button, className)} {...rest}>{children}</button>
    )
}