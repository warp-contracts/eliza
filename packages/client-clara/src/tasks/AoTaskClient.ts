import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ClientBase } from "../base.ts";
import { AoMessageHandler } from "./handlers/AoMessageHandler.ts";
import { ClaraLoadTaskType, ClaraTaskType } from "../ao_types.ts";

export const CLARA_TASK_ASSIGNMENT_TAG_NAME = "Task-Assignment";

export class ClaraTaskClient {
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
                this.client.claraConfig.CLARA_POLL_INTERVAL * 1000
            );
        };
        handleAoTasksLoop();
    }

    private async handleAoTasks() {
        elizaLogger.log("Checking AO tasks");
        try {
            const messageToProcess = await this.getMessageToProcess();
            if (messageToProcess) {
                elizaLogger.log(
                    "New Clara task to be processed",
                    messageToProcess
                );
                await this.messageHandler.handle(messageToProcess);
            }
            await this.client.cacheLatestCheckedMessageTimestamp(
                this.client.claraConfig.CLARA_IMPL
            );
            elizaLogger.log("Finished checking AO tasks");
        } catch (error) {
            console.log(error);
            elizaLogger.error("Error handling AO tasks:", error);
        }
    }

    private async getMessageToProcess(): Promise<ClaraTaskType> {
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao": {
                const message =
                    (await this.client.claraClient.claraMarket.profile.loadNextAssignedTask()) as ClaraTaskType;
                if (
                    message &&
                    (!this.client.lastCheckedMessageTs ||
                        message.timestamp > this.client.lastCheckedMessageTs)
                ) {
                    return message;
                }
            }
            case "story": {
                const cursor = this.client.lastCheckedMessageTs;
                const loadTaskResult = cursor
                    ? ((await this.client.claraClient.claraMarket.profile.loadNextAssignedTask(
                          BigInt(cursor)
                      )) as ClaraLoadTaskType)
                    : ((await this.client.claraClient.claraMarket.profile.loadNextAssignedTask()) as ClaraLoadTaskType);
                if (loadTaskResult?.result) {
                    const message: ClaraTaskType = {
                        ...loadTaskResult.result,
                        id: loadTaskResult.result.id.toString(),
                        timestamp: Number(loadTaskResult.result.timestamp),
                        contextId: loadTaskResult.result.contextId.toString(),
                        cursor: loadTaskResult.cursor,
                        reward: loadTaskResult.result.reward.toString(),
                    };
                    return message;
                }
            }
            default:
                return null;
        }
    }
}
