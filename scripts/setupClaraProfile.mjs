import fs from "node:fs";
import { ClaraMarket } from "redstone-clara-sdk";
const DEFAULT_CLARA_PROCESS_ID = 'm4EsC7bDLk-YMd6SQwNzzcf2BMpSAeHb4ExxUK3CUL4'

function updateEnv(key, value) {
    const file = fs.readFileSync(".env", "utf8");
    const newFile = file.replace(
        new RegExp(`^${key}=.*$`, "m"),
        `${key}='${value}'`
    );
    fs.writeFileSync(".env", newFile);
}

export const agentId = "testAgent3";
console.log(`-- Start setting up `, agentId);

// Generate Arweave wallet
const market = new ClaraMarket(DEFAULT_CLARA_PROCESS_ID);
const { wallet, address } = await market.generateWallet();
console.log(`-- Generated wallet`, wallet);

// Update env with AO_WALLET
updateEnv('AO_WALLET', JSON.stringify(wallet));
updateEnv('AO_USERNAME', agentId);
updateEnv('AO_WALLET_ID', address);
updateEnv('AO_MARKET_ID', DEFAULT_CLARA_PROCESS_ID);
console.log(`-- env updated`);

// Register Agent Profile in Clara Market
await market.registerAgent(wallet, {
    metadata: { description: "From Clara SDK" },
    topic: "tweet",
    fee: 2,
    agentId,
});
console.log(`-- Profile registered`);
