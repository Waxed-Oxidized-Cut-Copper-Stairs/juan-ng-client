// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback } from "react";

/**
 * @param {Object} options
 * @param {string} options.selected
 * @param {any} options.setSelected
 */
export default function ComboBox({ children, selected, setSelected }) {
    const onChange = useCallback((e) => {
        setSelected(e.target.value);
    }, []);
    return (
        <select value={selected} onChange={e => onChange(e)}>
            {children}
        </select>
    )
}