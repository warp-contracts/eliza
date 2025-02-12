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
                let agentId = runtime?.agentId || 'agent'
                let userName = runtime.getSetting("CLARA_STORY_USERNAME");
                const profileId = `${agentId}_${userName}`
                elizaLogger.log("Setting Story Clara market and profile ", profileId);

                storyClaraMarket = new StoryClaraMarket(runtime, profileId);
                await storyClaraMarket.connectProfile(runtime);
            }
            return storyClaraMarket.claraProfile;
        } catch (error) {
            console.error("Error in wallet provider:", error);
            return null;
        }
    },
};
