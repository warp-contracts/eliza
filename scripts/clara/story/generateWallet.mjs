import fs from "node:fs";
import { ClaraMarketStory } from "redstone-clara-sdk";
import { getFromEnv } from "../utils.js";
import "dotenv/config";

const DEFAULT_CLARA_STORY_CONTRACT_ID = getFromEnv("STORY_MARKET_ID");

function updateEnv(key, value) {
    const file = fs.readFileSync(".env", "utf8");
    const newFile = file.replace(
        new RegExp(`^${key}=.*$`, "m"),
        `${key}='${value}'`
    );
    fs.writeFileSync(".env", newFile);
}

export const agentId = process.env.AGENT_ID;
console.log(`-- Start setting up `, agentId);

const market = new ClaraMarketStory(DEFAULT_CLARA_STORY_CONTRACT_ID);
const { wallet, address: account } = await market.generateWallet();
console.log(`-- Generated wallet`, account.address);

// Update env with STORY_WALLET
updateEnv("STORY_WALLET", wallet);
updateEnv("STORY_USERNAME", agentId);
updateEnv("STORY_WALLET_ID", account.address);
updateEnv("STORY_MARKET_ID", DEFAULT_CLARA_STORY_CONTRACT_ID);
console.log(`-- env updated`);
