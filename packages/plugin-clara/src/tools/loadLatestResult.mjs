import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";

const claraMarket = new ClaraMarketStory(
    process.env.CLARA_STORY_MARKET_CONTRACT_ADDRESS
);
const claraProfile = new ClaraProfileStory(
    process.env.CLARA_STORY_WALLET,
    process.env.CLARA_STORY_MARKET_CONTRACT_ADDRESS
);

const loadTaskResult = await claraProfile.loadNextTaskResult();
console.log(loadTaskResult);

const cursor = loadTaskResult.cursor;
console.log(await claraProfile.loadNextTaskResult(cursor));
