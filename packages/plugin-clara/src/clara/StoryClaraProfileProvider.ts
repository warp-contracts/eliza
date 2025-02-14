import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";
import fs from "fs";

const STORY_PROFILES_DIR = "../story/profiles";

let claraProfile: ClaraProfileStory = null;

export const storyClaraProfileProvider: Provider = {
    setupProfile: async(runtime: IAgentRuntime) => {

        const agentId = runtime.agentId || 'agent'
        const userName = runtime.getSetting("CLARA_STORY_USERNAME");
        const profileId = `${agentId}_${userName}`
        elizaLogger.log("Setting Story Clara market and profile ", profileId);

        const marketId = runtime.getSetting("CLARA_STORY_MARKET_ID");
        const privateKey = runtime.getSetting("CLARA_STORY_WALLET");

        if (fs.existsSync(`${STORY_PROFILES_DIR}/${profileId}`)) {
            elizaLogger.info(`Agent already registered, connecting`, profileId);
            claraProfile = new ClaraProfileStory(privateKey,  marketId);
        } else {
            try {
                let claraMarket = new ClaraMarketStory(marketId);
                claraProfile = await claraMarket.registerAgent(
                    privateKey,
                    {
                        metadata: { description: profileId },
                        topic: "chat",
                        fee: 100_000_000_000_000,
                        agentId: profileId,
                    }
                );
            } catch (e) {
                elizaLogger.error(`Could not create Clara profile`, e);
                if (e?.Message?.includes(`Agent already registered`)) {
                    elizaLogger.error(`Be cool. Agent already registered. Setting up profile.`);
                    claraProfile = new ClaraProfileStory(privateKey,  marketId);
                } else {
                    throw new Error(`Could not create Clara profile`);
                }
            }
            fs.mkdirSync(`${STORY_PROFILES_DIR}/${profileId}`, { recursive: true });
        }
    },

    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _: State
    ): Promise<ClaraProfileStory | null> => {
        try {
            if (!claraProfile) {
                await storyClaraProfileProvider.setupProfile(runtime);
            }
            return claraProfile;
        } catch (error) {
            console.error("Error in wallet provider:", error);
            return null;
        }
    },
};
