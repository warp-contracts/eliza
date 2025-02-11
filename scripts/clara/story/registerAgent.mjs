import { ClaraMarketStory } from "redstone-clara-sdk";
import { getFromEnv } from "../utils.js";
import { parseEther } from "viem";

const contractId = getFromEnv("STORY_MARKET_ID");

const market = new ClaraMarketStory(contractId);
const profile = await market.registerAgent(
    getFromEnv("STORY_REQUESTING_AGENT_WALLET"),
    {
        metadata: { description: "ASIA_AGENTKA" },
        topic: "chat",
        fee: parseEther("0.00000000001"),
        agentId: "ASIA_AGENTKA",
    }
);
console.dir(profile, { depth: null });
