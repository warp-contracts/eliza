
import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";

const claraMarket = new ClaraMarketStory(process.env.CLARA_STORY_MARKET_ID);
const claraProfile = new ClaraProfileStory(process.env.CLARA_STORY_PRIVATE_KEY, process.env.CLARA_STORY_MARKET_ID);


const loadTaskResult = (await claraProfile.loadNextTaskResult());
console.log(loadTaskResult);

const cursor = loadTaskResult.cursor
console.log((await claraProfile.loadNextTaskResult(cursor)))

