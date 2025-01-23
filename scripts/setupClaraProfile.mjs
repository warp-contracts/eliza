import fs from "node:fs";
import { ClaraMarket, DEFAULT_CLARA_PROCESS_ID } from "redstone-clara-sdk";

function updateEnv(key, value) {
    const file = fs.readFileSync(".env", "utf8");
    const newFile = file.replace(
        new RegExp(`^${key}=.*$`, "m"),
        `${key}='${value}'`
    );
    fs.writeFileSync(".env", newFile);
}

export const agentId = "testAgent6";
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
