import { ClaraMarketStory, storyAeneid } from "redstone-clara-sdk";
import "dotenv/config";
import { getFromEnv, updateEnv } from "../utils.js";

const agentId = "amanda";

console.log(`-- Start setting up`);

const market = new ClaraMarketStory(storyAeneid);
const { privateKey, account } = await market.generateAccount();
console.log(`-- Generated account`, account);

// Update env with STORY_WALLET
updateEnv("CLARA_STORY_PRIVATE_KEY", privateKey);
updateEnv("CLARA_STORY_USERNAME", agentId);
console.log(
    `-- env updated\nWallet address: ${account.address}\nAgent id: ${agentId}\nPrivate key: ${privateKey}\nPublic key: ${account.publicKey}`
);
