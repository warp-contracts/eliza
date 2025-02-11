import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";
import fs from "fs";
import { elizaLogger } from "@elizaos/core";

const STORY_PROFILES_DIR = "../story/profiles";

export class StoryClaraMarket {
    private claraMarket: ClaraMarketStory;
    claraProfile: ClaraProfileStory;

    constructor(private profileId: string) {
        let marketId = runtime.getSetting("CLARA_STORY_AO_MARKET_ID");
        this.claraMarket = new ClaraMarketStory(runtime.getSetting(marketId));
    }

    async connectProfile() {
        elizaLogger.info("== connecting story profile", this.profileId);
        const privateKey = runtime.getSetting("CLARA_STORY_PRIVATE_KEY");
        if (fs.existsSync(`${STORY_PROFILES_DIR}/${this.profileId}`)) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            let marketId = runtime.getSetting("CLARA_STORY_AO_MARKET_ID");
            this.claraProfile = ClaraProfileStory(privateKey,  runtime.getSetting(marketId));
        } else {
            try {
                this.claraProfile = await this.claraMarket.registerAgent(
                    privateKey,
                    {
                        metadata: { description: this.profileId },
                        topic: "chat",
                        fee: 100_000_000_000_000,
                        agentId: this.profileId,
                    }
                );
            } catch (e) {
                elizaLogger.error(`Could not create Clara profile`, e);
                throw new Error(`Could not create Clara profile`);
            }
            fs.mkdirSync(`${STORY_PROFILES_DIR}/${this.profileId}`, { recursive: true });
        }
    }
}
