import {elizaLogger, IAgentRuntime, Memory, Provider, State, parseBooleanFromText} from "@elizaos/core";
import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";

const STORY_PROFILES_DIR = `../story/profiles`;


function storyProfileProvider(claraProfile): Provider {
    return {
        get: async (
            runtime: IAgentRuntime,
            _message: Memory,
            _: State
        ): Promise<ClaraProfileStory | null> => {
            return claraProfile;
        },
    }
}

export async function initializeClaraProfileProvider(): Provider {
    const pluginEnabled = parseBooleanFromText(process.env.ENABLE_CLARA_PROTOCOL_PLUGIN);
    if (!pluginEnabled) {
        elizaLogger.info(`Clara protocol plugin is disabled`);
        return storyProfileProvider(null);
    }

    const privateKey = process.env.CLARA_STORY_PRIVATE_KEY;
    const userName = process.env.CLARA_STORY_USERNAME;
    const marketId = process.env.CLARA_STORY_MARKET_ID;

    if (!privateKey || !userName || !marketId) {
        elizaLogger.error(`Missing Clara protocol plugin settings`);
        return storyProfileProvider(null);
    }

    elizaLogger.log(`Setting Story Clara profile ${userName} for market ${marketId}`);

    const storyAccount = privateKeyToAccount(privateKey);
    const claraMarket = new ClaraMarketStory(marketId);
    let claraProfile = null;

    if (fs.existsSync(`${STORY_PROFILES_DIR}/${userName}`)) {
        elizaLogger.info(`Agent already registered`, userName);
        claraProfile = new ClaraProfileStory(storyAccount,  marketId);
    } else {
        try {
            claraProfile = await claraMarket.registerClient(
                storyAccount,
                {
                    metadata: { description: userName },
                }
            );
        } catch (e) {
            elizaLogger.error(`Could not create Clara profile`, e);
            if (e?.Message?.includes(`Agent already registered`)) {
                elizaLogger.error(`Be cool. Agent already registered. Setting up profile.`);
                claraProfile = new ClaraProfileStory(storyAccount,  marketId);
            } else {
                throw new Error(`Could not create Clara profile`);
            }
        }
        fs.mkdirSync(`${STORY_PROFILES_DIR}/${userName}`, { recursive: true });
    }
    storyProfileProvider(claraProfile);
}

export const storyClaraProfileProvider = await initializeClaraProfileProvider();
