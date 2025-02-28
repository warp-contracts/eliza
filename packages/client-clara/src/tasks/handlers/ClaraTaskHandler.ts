import {
    Action,
    Content,
    elizaLogger,
    getEmbeddingZeroVector,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    stringToUuid,
    UUID,
} from "@elizaos/core";
import { ClaraClient } from "../../ClaraClient";
import { ClaraTaskType } from "../../utils/claraTypes";
import { wait } from "../../utils/utils";
import { ClaraTask } from "../ClaraTask";
import { ClaraStateCompositionHandler } from "./ClaraStateCompositionHandler";

export class ClaraTaskHandler extends ClaraTask {
    private stateCompositionHandler: ClaraStateCompositionHandler;
    constructor(client: ClaraClient, runtime: IAgentRuntime) {
        super(client, runtime);
        this.stateCompositionHandler = new ClaraStateCompositionHandler(
            this.runtime,
            this.client
        );
    }

    async handle({ claraMessage, claraMessageId, claraRoomId }): Promise<void> {
        const { payload, id, topic, requester } = claraMessage;
        if (!payload || typeof payload !== "string") {
            elizaLogger.error(`Task id ${id}, invalid payload : `, payload);
            return;
        }
        if (
            !this.runtime.actions.find(
                (a: Action) => a.name.toLowerCase() == topic.toLowerCase()
            ) &&
            !this.runtime.actions.find((action: Action) =>
                action.similes.find(
                    (simly: any) => simly.toLowerCase() == topic.toLowerCase()
                )
            )
        ) {
            elizaLogger.log(
                `Clara task could not be processed, no action with name ${topic}.`
            );
            return;
        }
        const userIdUUID = this.buildUserUUID(requester);
        await this.runtime.ensureConnection(
            userIdUUID,
            claraRoomId,
            requester,
            requester,
            "clara"
        );
        const memory = this.buildMemory(payload, claraRoomId, userIdUUID);
        const state = await this.stateCompositionHandler.handle(
            claraMessage,
            payload,
            memory
        );
        await this.processTaskInActions(
            state,
            memory,
            claraMessage,
            claraRoomId,
            claraMessageId,
            payload,
            topic,
            id
        );
    }

    private async processTaskInActions(
        state: any,
        memory: any,
        claraMessage: ClaraTaskType,
        roomId: UUID,
        messageId: UUID,
        prompt: string,
        task: string,
        taskId: string
    ) {
        const self = this;
        try {
            const callback: HandlerCallback = async (content: Content) => {
                if (!content.text) {
                    elizaLogger.log(
                        `Could not send result, no content generated.`
                    );
                    return [];
                }
                self.client.updateLastCheckedMessage(claraMessage);
                await self.client.sendTaskResult(taskId, content);
                return [];
            };
            const responseMessage: Memory = {
                id: messageId,
                userId: this.client.runtime.agentId,
                agentId: this.client.runtime.agentId,
                createdAt: Date.now(),
                content: {
                    text: prompt,
                    action: task,
                    source: "Clara",
                },
                embedding: getEmbeddingZeroVector(),
                roomId,
            };
            await this.runtime.messageManager.createMemory(responseMessage);
            state = (await this.runtime.updateRecentMessageState(
                state
            )) as State;
            await this.runtime.processActions(
                memory,
                [responseMessage],
                state,
                callback
            );
            await wait();
        } catch (error) {
            elizaLogger.error(`Error sending response message: ${error}`);
        }
    }

    private buildMemory(prompt: string, claraRoomId: UUID, userIdUUID: UUID) {
        return {
            content: { text: prompt },
            agentId: this.runtime.agentId,
            userId: userIdUUID,
            roomId: claraRoomId,
        };
    }

    private buildUserUUID(owner: string): UUID {
        return stringToUuid(owner);
    }
}
