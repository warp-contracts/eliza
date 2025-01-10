import {
    Client,
    elizaLogger,
    IAgentRuntime,
} from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateAoTheComputerConfig, AoTheComputerConfig } from "./environment.ts";
import { AoTheComputerInteractionClient } from "./interactions.ts";
import { AoTheComputerPostClient } from "./post.ts";
import { AoSearchClient } from "./search.ts";

/**
 * A manager that orchestrates all specialized AoTheComputer logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 */
class AoTheComputerManager {
    client: ClientBase;
    post: AoTheComputerPostClient;
    search: AoSearchClient;
    interaction: AoTheComputerInteractionClient;

    constructor(runtime: IAgentRuntime, aoConfig: AoTheComputerConfig) {
        // Pass aoConfig to the base client
        this.client = new ClientBase(runtime, aoConfig);

        // Posting logic
        this.post = new AoTheComputerPostClient(this.client, runtime);

        // Optional search logic (enabled if AO_SEARCH_ENABLE is true)
        if (aoConfig.AO_SEARCH_ENABLE) {
            elizaLogger.warn("AoTheComputer/X client running in a mode that:");
            elizaLogger.warn("1. violates consent of random users");
            elizaLogger.warn("2. burns your rate limit");
            elizaLogger.warn("3. can get your account banned");
            elizaLogger.warn("use at your own risk");
            this.search = new AoSearchClient(this.client, runtime);
        }

        // Mentions and interactions
        this.interaction = new AoTheComputerInteractionClient(this.client, runtime);
    }
}

export const AoTheComputerClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const aoTheComputerConfig: AoTheComputerConfig = await validateAoTheComputerConfig(runtime);

        elizaLogger.log("===== AoTheComputer client started");

        const manager = new AoTheComputerManager(runtime, aoTheComputerConfig);

        // Initialize login/session
        await manager.client.init();

        // Start the posting loop
        await manager.post.start();

        // Start the search logic if it exists
        if (manager.search) {
            await manager.search.start();
        }

        // Start interactions (mentions, replies)
        await manager.interaction.start();

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("AoTheComputer client does not support stopping yet");
    },
};

export default AoTheComputerClientInterface;
