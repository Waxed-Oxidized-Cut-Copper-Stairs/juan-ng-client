// SPDX-License-Identifier: GPL-3.0-or-later

import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef } from "react";
import styles from "./LineEdit.module.css";
import { mergeClassName, mergeRef } from "../toolkit";

export default function LineEdit({ text, setText, placeholder = undefined, onChange: oldOnChange, onReturn, ref, ...rest }) {
    const nodeRef = useRef(null);
    const onChange = useCallback((e) => {
        if (typeof setText === "function") setText(e.target.value);
        if (typeof oldOnChange === "function") oldOnChange(e.target.value);
    }, [setText, oldOnChange]);
    useEffect(() => {
        if (typeof onReturn !== "function") return;
        /** @type {HTMLInputElement} */
        const input = nodeRef.current;
        if (!input) return;
        const abort = new AbortController();
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                onReturn(e);
                input.blur();
            }
        }, { signal: abort.signal });
        return () => {
            abort.abort();
        }
    }, [onReturn]);
    const mergedRef = useMemo(() => mergeRef(nodeRef, ref), [nodeRef, ref]);
    return (
        <input ref={mergedRef} type="text" value={text} placeholder={placeholder} onChange={e => onChange(e)} {...rest} />
    )
}

/**
 * 让作为 children 传入的 LineEdit 行为像一个搜索框
 * 在非输入区域按下 / 键时，会聚焦到搜索框
 */
export function LineEditStyledForSearch({ children, ref, className, ...rest }) {
    const nodeRef = useRef(null);
    const isTextInput = useCallback((el) => {
        if (!el) return false;
        const tag = el.tagName;
        if (tag === "TEXTAREA") return true;
        if (tag === "INPUT") {
            const nonTextTypes = [
                "button", "checkbox", "radio", "file",
                "submit", "reset", "image", "color", "range"
            ];
            return !nonTextTypes.includes(el.type);
        }
        if (el.isContentEditable) return true;
        return false;
    }, []);
    const mergedRef = useMemo(() => mergeRef(nodeRef, ref, children.props.ref), [nodeRef, ref, children.props.ref]);
    useEffect(() => {
        const abort = new AbortController();
        document.addEventListener("keydown", (e) => {
            /** @type {HTMLInputElement} */
            const input = nodeRef.current;
            if (!input) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (e.key !== "/") return;
            const active = document.activeElement;
            if (isTextInput(active)) return;
            e.preventDefault();
            input.focus();
            input.select();
        }, { signal: abort.signal });
        return () => {
            abort.abort();
        }
    }, []);
    if (!isValidElement(children)) return children;
    return cloneElement(children, { ...rest, ref: mergedRef, className: mergeClassName(children.props.className, className, styles.for_search) });
}