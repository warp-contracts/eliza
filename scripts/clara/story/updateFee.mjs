import { ClaraProfileStory, storyAeneid } from "redstone-clara-sdk";
import { getFromEnv } from "../utils.js";
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";

const account = privateKeyToAccount(
    getFromEnv(process.env.ENV_FILENAME || ".env", "CLARA_STORY_PRIVATE_KEY")
);

const profile = new ClaraProfileStory(
    account,
    getFromEnv(process.env.ENV_FILENAME, "CLARA_STORY_MARKET_CONTRACT_ADDRESS"),
    storyAeneid
);

const result = await profile.updateFee(parseEther("0.00001"));

console.log(`Fee updated`);
console.dir(result, { depth: null });
