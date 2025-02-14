import fs from "fs";

export function getFromEnv(key) {
    const fileContent = fs.readFileSync(".env", "utf8");
    const regex = new RegExp(`^${key}=(.*)$`, "m");
    const match = fileContent.match(regex);
    if (match) {
        return match[1].replaceAll("'", "");
    }
    return null;
}
