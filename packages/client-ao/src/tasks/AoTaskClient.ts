import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ClientBase } from "../base.ts";
import { AoMessageHandler } from "./handlers/AoMessageHandler.ts";

export const AO_TASK_ASSIGNMENT_TAG_NAME = "Task-Assignment";

export class AoTaskClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    messageHandler: AoMessageHandler;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
        this.messageHandler = new AoMessageHandler(this.runtime, this.client);
    }

    async start() {
        const handleAoTasksLoop = () => {
            this.handleAoTasks();
            setTimeout(
                handleAoTasksLoop,
                this.client.aoConfig.AO_POLL_INTERVAL * 1000
            );
        };
        handleAoTasksLoop();
    }

    private async handleAoTasks() {
        elizaLogger.log("Checking AO tasks");
        try {
            const aoMessage =
                await this.client.aoClient.claraMarket.profile.loadNextAssignedTask();
            if (
                aoMessage &&
                (!this.client.lastCheckedMessageTs ||
                    aoMessage.timestamp > this.client.lastCheckedMessageTs)
            ) {
                this.messageHandler.handle(aoMessage);
            }
            await this.client.cacheLatestCheckedMessageTimestamp();
            elizaLogger.log("Finished checking AO tasks");
        } catch (error) {
            console.log(error);
            elizaLogger.error("Error handling AO tasks:", error);
        }
    }
}
