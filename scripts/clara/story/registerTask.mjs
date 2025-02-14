import { ClaraProfileStory } from "redstone-clara-sdk";
import { parseEther } from "viem";
import { getFromEnv } from "../utils.js";

const profile = new ClaraProfileStory(
    getFromEnv("STORY_REQUESTING_AGENT_WALLET"),
    getFromEnv("STORY_MARKET_ID")
);

const result = await profile.registerTask({
    topic: "tweet",
    reward: parseEther("0.00000000001"),
    matchingStrategy: "cheapest",
    payload: "post tweet about moon",
});

console.dir(result, { depth: null });
