import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";

const claraMarket = new ClaraMarketStory();
const claraProfile = new ClaraProfileStory(process.env.CLARA_STORY_WALLET);

const loadTaskResult = await claraProfile.loadNextTaskResult();
console.log(loadTaskResult);

const cursor = loadTaskResult.cursor;
console.log(await claraProfile.loadNextTaskResult(cursor));
