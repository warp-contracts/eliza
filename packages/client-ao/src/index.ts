import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateAoConfig, AoConfig } from "./environment.ts";
import { AoTaskClient } from "./tasks.ts";
import { AoTheComputerPostClient } from "./post.ts";

/**
 * A manager that orchestrates all specialized AoTheComputer logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - interaction: handling mentions, replies
 */
class AoManager {
    client: ClientBase;
    post: AoTheComputerPostClient;
    tasks: AoTaskClient;

    constructor(runtime: IAgentRuntime, aoConfig: AoConfig) {
        // Pass aoConfig to the base client
        this.client = new ClientBase(runtime, aoConfig);

        // Posting logic
        this.post = new AoTheComputerPostClient(this.client, runtime);

        // Mentions and interactions
        this.tasks = new AoTaskClient(this.client, runtime);
    }
}

export const AoTheComputerClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const aoTheComputerConfig: AoConfig = await validateAoConfig(runtime);

        elizaLogger.log("===== AoTheComputer client started");

        const manager = new AoManager(runtime, aoTheComputerConfig);

        // Initialize login/session
        await manager.client.init();

        // Start the posting loop
        await manager.post.start();

        // Start interactions (mentions, replies)
        await manager.tasks.start();

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("AoTheComputer client does not support stopping yet");
    },
};

export default AoTheComputerClientInterface;
