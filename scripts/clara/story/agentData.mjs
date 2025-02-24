import { ClaraProfileStory, storyAeneid } from "redstone-clara-sdk";
import { getFromEnv } from "../utils.js";
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(
    getFromEnv(process.env.ENV_FILENAME || ".env", "CLARA_STORY_PRIVATE_KEY")
);

const profile = new ClaraProfileStory(
    account,
    getFromEnv(process.env.ENV_FILENAME, "CLARA_STORY_MARKET_ID"),
    storyAeneid
);

const result = await profile.agentData();

console.dir(result, { depth: null });
