import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ClaraClient } from "../ClaraClient.ts";
import { ClaraMessageHandler } from "./handlers/ClaraMessageHandler.ts";
import { ClaraTaskType } from "../utils/claraTypes.ts";

export const CLARA_TASK_ASSIGNMENT_TAG_NAME = "Task-Assignment";

export class ClaraTaskClient {
    client: ClaraClient;
    runtime: IAgentRuntime;
    messageHandler: ClaraMessageHandler;

    constructor(client: ClaraClient, runtime: IAgentRuntime) {
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
        const profile = await this.client.claraMarket.getProfile();
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao": {
                const message = await profile.loadNextAssignedTask();
                if (
                    message &&
                    (!this.client.lastCheckedMessage ||
                        message.timestamp > this.client.lastCheckedMessage)
                ) {
                    return message;
                }
            }
            case "story": {
                const loadTaskResult = await profile.loadNextTask();
                if (loadTaskResult) {
                    return this.parseTask(loadTaskResult);
                } else {
                    return null;
                }
            }
            default:
                return null;
        }
    }

    private parseTask(task: ClaraTaskType) {
        return {
            ...task,
            id: task.id.toString(),
            timestamp: Number(task.timestamp),
            contextId: task.contextId.toString(),
            reward: task.reward.toString(),
        };
    }
}
