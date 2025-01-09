import {
    Client,
    elizaLogger,
    IAgentRuntime,
} from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateAoTheComputerConfig, AoTheComputerConfig } from "./environment.ts";
import { AoTheComputerInteractionClient } from "./interactions.ts";
import { AoTheComputerPostClient } from "./post.ts";
import { AoTheComputerSearchClient } from "./search.ts";
import { AoTheComputerSpaceClient } from "./spaces.ts";

/**
 * A manager that orchestrates all specialized AoTheComputer logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 * - space: launching and managing AoTheComputer Spaces (optional)
 */
class AoTheComputerManager {
    client: ClientBase;
    post: AoTheComputerPostClient;
    search: AoTheComputerSearchClient;
    interaction: AoTheComputerInteractionClient;
    space?: AoTheComputerSpaceClient;

    constructor(runtime: IAgentRuntime, twitterConfig: AoTheComputerConfig) {
        // Pass twitterConfig to the base client
        this.client = new ClientBase(runtime, twitterConfig);

        // Posting logic
        this.post = new AoTheComputerPostClient(this.client, runtime);

        // Optional search logic (enabled if TWITTER_SEARCH_ENABLE is true)
        if (twitterConfig.TWITTER_SEARCH_ENABLE) {
            elizaLogger.warn("AoTheComputer/X client running in a mode that:");
            elizaLogger.warn("1. violates consent of random users");
            elizaLogger.warn("2. burns your rate limit");
            elizaLogger.warn("3. can get your account banned");
            elizaLogger.warn("use at your own risk");
            this.search = new AoTheComputerSearchClient(this.client, runtime);
        }

        // Mentions and interactions
        this.interaction = new AoTheComputerInteractionClient(this.client, runtime);

        // Optional Spaces logic (enabled if TWITTER_SPACES_ENABLE is true)
        if (twitterConfig.TWITTER_SPACES_ENABLE) {
            this.space = new AoTheComputerSpaceClient(this.client, runtime);
        }
    }
}

export const AoTheComputerClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const twitterConfig: AoTheComputerConfig = await validateAoTheComputerConfig(runtime);

        elizaLogger.log("AoTheComputer client started");

        const manager = new AoTheComputerManager(runtime, twitterConfig);

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

        // If Spaces are enabled, start the periodic check
        if (manager.space) {
            manager.space.startPeriodicSpaceCheck();
        }

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("AoTheComputer client does not support stopping yet");
    },
};

export default AoTheComputerClientInterface;
