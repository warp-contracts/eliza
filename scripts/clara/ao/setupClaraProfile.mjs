import fs from "node:fs";
import { ClaraMarket } from "redstone-clara-sdk";
const DEFAULT_CLARA_PROCESS_ID = 'ynXmUtQUgi3eAGF6TjNxS6Wo0uu228E7fGlmIzocc7U';

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

// Update env with CLARA_AO_WALLET
updateEnv('CLARA_AO_WALLET', JSON.stringify(wallet));
updateEnv('CLARA_AO_USERNAME', agentId);
updateEnv('CLARA_AO_WALLET_ID', address);
updateEnv('CLARA_AO_MARKET_ID', DEFAULT_CLARA_PROCESS_ID);
console.log(`-- env updated`);

