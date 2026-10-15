// SPDX-License-Identifier: GPL-3.0-or-later

export default function Button({ children, onClick, ...rest }) {
    return (
        <button onClick={onClick} {...rest}>{children}</button>
    )
}