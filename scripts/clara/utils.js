import fs from "fs";

export function getFromEnv(envFilename, key) {
    const fileContent = fs.readFileSync(envFilename, "utf8");
    const regex = new RegExp(`^${key}=(.*)$`, "m");
    const match = fileContent.match(regex);
    if (match) return match[1].replaceAll("'", "");
    return null;
}

export function updateEnv(key, value) {
    const file = fs.readFileSync(process.env.ENV_FILENAME, "utf8");
    const newFile = file.replace(
        new RegExp(`^${key}=.*$`, "m"),
        `${key}='${value}'`
    );
    fs.writeFileSync(".env", newFile);
}
