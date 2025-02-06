import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { ClientBase } from "../base.ts";
import { AoFetchMessageHandler } from "./handlers/AoFetchMessageHandler.ts";
import { AoMessageHandler } from "./handlers/AoMessageHandler.ts";

export const AO_TASK_ASSIGNMENT_TAG_NAME = "Task-Assignment";

export class AoTaskClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    fetchMessagesHandler: AoFetchMessageHandler;
    messageHandler: AoMessageHandler;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
        this.fetchMessagesHandler = new AoFetchMessageHandler(this.client);
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
            // const aoMessages = await this.fetchMessagesHandler.handle();
            const aoMessage =
                await this.client.aoClient.claraMarket.profile.loadNextAssignedTask();
            if (
                aoMessage &&
                (!this.client.lastCheckedMessageTs ||
                    aoMessage.timestamp > this.client.lastCheckedMessageTs)
            ) {
                this.messageHandler.handle(aoMessage);
            }
            // elizaLogger.debug(`next task result`, taskResult);
            // if (taskResult) {
            //     const foundReqTask = reqTaskId.find((r) =>
            //         taskResult.id.includes(r)
            //     );
            //     elizaLogger.debug(`found req task`, foundReqTask);
            //     if (foundReqTask) {
            //         total -= 1;
            //         results[foundReqTask] = {
            //             ...results[foundReqTask],
            //             [taskResult.id]: taskResult,
            //         };
            //         if (total <= 0) {
            //             clearInterval(intervalId);
            //             resolve(results);
            //         }
            //     }
            // }
            // for (const aoMessage of aoMessages) {
            //     if (
            //         !this.client.lastCheckedMessageTs ||
            //         aoMessage.ingested_at > this.client.lastCheckedMessageTs
            //     ) {
            //         this.messageHandler.handle(aoMessage);
            //     }
            // }
            await this.client.cacheLatestCheckedMessageTimestamp();
            elizaLogger.log("Finished checking AO tasks");
        } catch (error) {
            console.log(error);
            elizaLogger.error("Error handling AO tasks:", error);
        }
    }
}
