import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import {StoryClaraMarket} from "./StoryClaraMarket.ts";
import { ClaraProfileStory } from "redstone-clara-sdk";

let storyClaraMarket: StoryClaraMarket = null;

export const storyClaraProfileProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _: State
    ): Promise<ClaraProfileStory | null> => {
        try {
            if (!storyClaraMarket) {
                let userName = runtime.getSetting("CLARA_STORY_USERNAME");
                const profileId = `${runtime?.agentId}_${userName}`
                elizaLogger.log("Setting Story Clara market and profile ", profileId);

                storyClaraMarket = new StoryClaraMarket(profileId);
                await storyClaraMarket.connectProfile();
            }
            return storyClaraMarket.claraProfile;
        } catch (error) {
            console.error("Error in wallet provider:", error);
            return null;
        }
    },
};
