// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Popup.module.css";

export default function Popup({ open, children, onClose }) {
    const maskRef = useRef(null);
    const popupRef = useRef(null);
    const timerRef = useRef(null);
    const oldDisplayRef = useRef("");
    const oldPopupDisplayRef = useRef("");
    const handleMaskClick = useCallback((e) => {
        if (e.target !== e.currentTarget) return;
        onClose?.();
    }, []);
    const clearAnimation = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);
    useLayoutEffect(() => {
        /** @type {HTMLDivElement} */
        const mask = maskRef.current;
        /** @type {HTMLDivElement} */
        const popup = popupRef.current;
        if (!mask || !popup) return;
        clearAnimation();
        if (open) {
            mask.style.display = oldDisplayRef.current;
            popup.style.display = oldPopupDisplayRef.current;
            mask.style.opacity = "0";
            popup.style.transform = "translateY(8px) scale(0.96)";
            // 强制回流
            void mask.offsetHeight;
            void popup.offsetHeight;
            requestAnimationFrame(() => {
                mask.style.opacity = "1";
                popup.style.transform = "translateY(0) scale(1)";
            });
        } else {
            mask.style.opacity = "0";
            popup.style.transform = "translateY(8px) scale(0.96)";
            timerRef.current = setTimeout(() => {
                oldDisplayRef.current = mask.style.display;
                oldPopupDisplayRef.current = popup.style.display;
                mask.style.display = "none";
                popup.style.display = "none";
                timerRef.current = null;
            }, 150);
        }
    }, [open, clearAnimation]);
    useEffect(() => {
        /** @type {HTMLDivElement} */
        const mask = maskRef.current;
        /** @type {HTMLDivElement} */
        const popup = popupRef.current;
        if (!mask || !popup) return;
        oldDisplayRef.current = mask.style.display;
        oldPopupDisplayRef.current = popup.style.display;
        mask.style.opacity = open ? "1" : "0";
        // 强制回流，保证初始状态正确
        void mask.offsetHeight;
        void popup.offsetHeight;
    }, []);
    return createPortal(
        <div ref={maskRef} className={styles.mask} onClick={(e) => handleMaskClick(e)}>
            <div
                ref={popupRef}
                className={styles.popup}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}