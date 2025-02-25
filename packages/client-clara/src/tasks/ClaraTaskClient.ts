import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ClaraClientBase } from "../ClaraClientBase.ts";
import { ClaraMessageHandler } from "./handlers/ClaraMessageHandler.ts";
import { ClaraTaskType } from "../utils/claraTypes.ts";
import { StoryClaraMarket } from "../market/StoryClaraMarket.ts";

export const CLARA_TASK_ASSIGNMENT_TAG_NAME = "Task-Assignment";

export class ClaraTaskClient {
    client: ClaraClientBase;
    runtime: IAgentRuntime;
    messageHandler: ClaraMessageHandler;

    constructor(client: ClaraClientBase, runtime: IAgentRuntime) {
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
            elizaLogger.log(error);
            elizaLogger.error("Error handling Clara tasks:", error);
        }
    }

    private async getMessageToProcess(): Promise<ClaraTaskType> {
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao": {
                const message = (await this.client.claraMarket
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
                const market = this.client.claraMarket as StoryClaraMarket;
                const loadTaskResult = await market.getProfile().loadNextTask();
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
