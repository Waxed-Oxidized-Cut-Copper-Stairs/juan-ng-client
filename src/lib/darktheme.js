const media = window.matchMedia("(prefers-color-scheme: dark)");
media.addEventListener("change", () => update());

/** @type {Set<HTMLElement>} */
const roots = new Set();
/** @param {HTMLElement} root */
function apply(root) {
    root.setAttribute("theme", media.matches ? "dark" : "light");
}
function update() {
    for (const root of roots) apply(root);
}
/** @param {HTMLElement} root */
export function registerRoot(root) {
    apply(root);
    roots.add(root);
    return () => {
        roots.delete(root);
    }
}
