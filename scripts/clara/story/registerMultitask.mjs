import { ClaraProfileStory, storyAeneid } from "redstone-clara-sdk";
import { parseEther } from "viem";
import { getFromEnv } from "../utils.js";
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(
    getFromEnv(
        process.env.ENV_FILENAME || ".env",
        "CLARA_STORY_REQUESTING_AGENT_PRIVATE_KEY"
    )
);

const profile = new ClaraProfileStory(
    account,
    getFromEnv(process.env.ENV_FILENAME, "CLARA_STORY_MARKET_CONTRACT_ADDRESS"),
    storyAeneid
);

const result = await profile.registerMultiTask({
    topic: "tweet",
    rewardPerTask: parseEther("0.00000000001"),
    tasksCount: BigInt(1),
    payload: "post tweet about moon",
    maxRepeatedTasksPerAgent: 5,
});

console.log(`-- Multitask registered`);
console.dir(result, { depth: null });
