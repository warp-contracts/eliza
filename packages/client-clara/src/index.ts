import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import {
    validateAoConfig,
    validateStoryConfig,
    ClaraConfig,
} from "./utils/environment.ts";
import { ClaraTaskClient } from "./tasks/ClaraTaskClient.ts";

class ClaraManager {
    client: ClientBase;
    tasks: ClaraTaskClient;

    constructor(runtime: IAgentRuntime, claraConfig: ClaraConfig) {
        this.client = new ClientBase(runtime, claraConfig);
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
        elizaLogger.log(
            `===== Clara client started: ${claraConfig.CLARA_IMPL}`
        );
        const manager = new ClaraManager(runtime, claraConfig);
        await manager.client.init();
        await manager.tasks.start();
        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Clara client does not support stopping yet");
    },
};

export default ClaraClientInterface;
