import { ClaraMarketStory, storyAeneid } from "redstone-clara-sdk";
import "dotenv/config";
import { getFromEnv, updateEnv } from "../utils.js";

const agentId = "amanda";

const DEFAULT_CLARA_STORY_CONTRACT_ID = getFromEnv(
    process.env.ENV_FILENAME,
    "CLARA_STORY_MARKET_ID"
);
console.log(`-- Start setting up`);

const market = new ClaraMarketStory(
    DEFAULT_CLARA_STORY_CONTRACT_ID,
    storyAeneid
);
const { privateKey, account } = await market.generateAccount();
console.log(`-- Generated account`, account);

// Update env with STORY_WALLET
updateEnv("CLARA_STORY_PRIVATE_KEY", privateKey);
updateEnv("CLARA_STORY_ACCOUNT", account);
updateEnv("CLARA_STORY_USERNAME", agentId);
updateEnv("CLARA_STORY_MARKET_ID", DEFAULT_CLARA_STORY_CONTRACT_ID);
console.log(`-- env updated`);
