import { ClaraProfileStory, storyAeneid } from "redstone-clara-sdk";
import { getFromEnv } from "../utils.js";
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(
    getFromEnv(process.env.ENV_FILENAME || ".env", "CLARA_STORY_PRIVATE_KEY")
);

const profile = new ClaraProfileStory(account, storyAeneid);

const result = await profile.withdrawEarnedRewards(true);

console.dir(result, { depth: null });
