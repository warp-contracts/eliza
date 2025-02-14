import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ClientBase } from "../base.ts";
import { ClaraMessageHandler } from "./handlers/ClaraMessageHandler.ts";
import { ClaraLoadTaskType, ClaraTaskType } from "../utils/claraTypes.ts";

export const CLARA_TASK_ASSIGNMENT_TAG_NAME = "Task-Assignment";

export class ClaraTaskClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    messageHandler: ClaraMessageHandler;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
        this.messageHandler = new ClaraMessageHandler(
            this.runtime,
            this.client
        );
    }

    async start() {
        const handleTasksLoop = () => {
            this.handleTasks();
            setTimeout(
                handleTasksLoop,
                this.client.claraConfig.CLARA_POLL_INTERVAL * 1000
            );
        };
        handleTasksLoop();
    }

    private async handleTasks() {
        elizaLogger.info("Checking CLARA tasks");
        try {
            const messageToProcess = await this.getMessageToProcess();
            if (messageToProcess) {
                await this.messageHandler.handle(messageToProcess);
            }
            await this.client.cacheLatestCheckedMessage(
                this.client.claraConfig.CLARA_IMPL
            );
            elizaLogger.info("Finished checking Clara tasks");
        } catch (error) {
            console.log(error);
            elizaLogger.error("Error handling Clara tasks:", error);
        }
    }

    private async getMessageToProcess(): Promise<ClaraTaskType> {
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao": {
                const message = (await this.client.claraClient.claraMarket
                    .getProfile()
                    .loadNextAssignedTask()) as ClaraTaskType;
                if (
                    message &&
                    (!this.client.lastCheckedMessage ||
                        message.timestamp > this.client.lastCheckedMessage)
                ) {
                    return message;
                }
            }
            case "story": {
                const cursor = this.client.lastCheckedMessage;
                const loadTaskResult = cursor
                    ? ((await this.client.claraClient.claraMarket
                          .getProfile()
                          .loadNextAssignedTask(
                              BigInt(cursor)
                          )) as ClaraLoadTaskType)
                    : ((await this.client.claraClient.claraMarket
                          .getProfile()
                          .loadNextAssignedTask()) as ClaraLoadTaskType);
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
                } else {
                    return null;
                }
            }
            default:
                return null;
        }
    }
}
