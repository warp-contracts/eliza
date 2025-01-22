import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateAoConfig, AoConfig } from "./environment.ts";
import { AoTaskClient } from "./tasks/AoTaskClient.ts";

/**
 * A manager that orchestrates all specialized AoTheComputer logic:
 * - client: base operations (login, timeline caching, etc.)
 * - interaction: fetching assigned tasks
 */
class AoManager {
    client: ClientBase;
    tasks: AoTaskClient;

    constructor(runtime: IAgentRuntime, aoConfig: AoConfig) {
        // Pass aoConfig to the base client
        this.client = new ClientBase(runtime, aoConfig);

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

        // Start fetching interactions
        await manager.tasks.start();

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("AoTheComputer client does not support stopping yet");
    },
};

export default AoTheComputerClientInterface;
