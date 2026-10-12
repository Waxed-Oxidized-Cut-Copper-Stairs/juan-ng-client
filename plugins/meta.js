import { execSync } from "child_process";

export const juanVersion = "3.0.0";
export const commitHash = (() => {
    try {
        return execSync("git rev-parse --short HEAD").toString().trim()
    } catch {
        return "unknown"
    }
})();