import {elizaLogger, IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import {AoClaraMarket} from "./AoClaraMarket.ts";
import { ClaraProfile } from "redstone-clara-sdk";

let aoClaraMarket: AoClaraMarket = null;

export const claraProfileProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _: State
    ): Promise<ClaraProfile | null> => {
        try {
            if (!aoClaraMarket) {
                const profileId = `${runtime?.agentId}_${process.env.AO_USERNAME}`
                elizaLogger.log("Setting AO Clara market and profile ", profileId);

                aoClaraMarket = new AoClaraMarket(profileId);
                await aoClaraMarket.connectProfile();
            }
            return aoClaraMarket.claraProfile;
        } catch (error) {
            console.error("Error in wallet provider:", error);
            return null;
        }
    },
};
