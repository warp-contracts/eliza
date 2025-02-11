import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateAoConfig, AoConfig, validateStoryConfig, ClaraConfig } from "./environment.ts";
import { ClaraTaskClient } from "./tasks/AoTaskClient.ts";

/**
 * A manager that orchestrates all specialized Clara logic:
 * - client: base operations (login, timeline caching, etc.)
 * - interaction: fetching assigned tasks
 */
class ClaraManager {
    client: ClientBase;
    tasks: ClaraTaskClient;

    constructor(runtime: IAgentRuntime, claraConfig: ClaraConfig) {
        // Pass claraConfig to the base client
        this.client = new ClientBase(runtime, claraConfig);

        // Mentions and interactions
        this.tasks = new ClaraTaskClient(this.client, runtime);
    }
}

export const ClaraClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        let claraConfig: ClaraConfig;
        if (runtime.getSetting("AO_WALLET") || process.env.AO_WALLET) {
            claraConfig = await validateAoConfig(runtime);
        } else {
            claraConfig = await validateStoryConfig(runtime);
        }

        elizaLogger.log("===== Clara client started");

        const manager = new ClaraManager(runtime, claraConfig);

        // Initialize login/session
        await manager.client.init();
 
        // Start fetching interactions
        await manager.tasks.start();

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Clara client does not support stopping yet");
    },
};

export default ClaraClientInterface;
