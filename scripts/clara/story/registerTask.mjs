import {
    ClaraProfileStory,
    storyAeneid,
    storyMainnet,
} from "redstone-clara-sdk";
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

const profile = new ClaraProfileStory(account, storyAeneid);

const result = await profile.registerTask({
    topic: "tweet",
    reward: parseEther("0.00000000001"),
    matchingStrategy: "cheapest",
    payload: "post tweet with informations about RedStone Oracles",
});

console.log(`-- Task registered`);
console.dir(result, { depth: null });
