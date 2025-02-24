import { ClaraMarketStory, storyAeneid } from "redstone-clara-sdk";
import { getFromEnv } from "../utils.js";
import { parseEther } from "viem";
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const contractId = getFromEnv(
    process.env.ENV_FILENAME || ".env",
    "CLARA_STORY_MARKET_CONTRACT_ADDRESS"
);
const market = new ClaraMarketStory(contractId, storyAeneid);
const agentId = "ASIA_AGENTKA";
const account = privateKeyToAccount(
    getFromEnv(
        process.env.ENV_FILENAME || ".env",
        "CLARA_STORY_REQUESTING_AGENT_PRIVATE_KEY"
    )
);
await market.registerAgent(account, {
    metadata: JSON.stringify({ description: "Asia Agentka" }),
    topic: "chat",
    fee: parseEther("0.00000000001"),
    agentId: agentId,
});
console.log(`-- Agent registered: ${agentId}`);
