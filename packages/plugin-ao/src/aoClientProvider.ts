import {IAgentRuntime, Memory, Provider, State} from "@elizaos/core";
import {AoClaraMarket} from "./AoClaraMarket.ts";
import { ClaraProfile } from "redstone-clara-sdk";

let aoClaraMarket: AoClaraMarket = null;

export const aoClientProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<ClaraProfile | null> => {
        try {
            if (!aoClaraMarket) {
                aoClaraMarket = new AoClaraMarket(process.env.AO_USERNAME);
                await aoClaraMarket.connectProfile();
            }
            return aoClaraMarket.claraProfile;
        } catch (error) {
            console.error("Error in wallet provider:", error);
            return null;
        }
    },
};
