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
import { ClientBase } from "../../base";
import { NodeType } from "../../ao_types";
import { AoStateCompositionHandler } from "./AoStateCompositionHandler";
import { wait } from "../../utils";
import { AoTask } from "../AoTask";

export class AoTaskHandler extends AoTask {
    private stateCompositionHandler: AoStateCompositionHandler;
    constructor(client: ClientBase, runtime: IAgentRuntime) {
        super(client, runtime);
        this.stateCompositionHandler = new AoStateCompositionHandler(
            this.runtime,
            this.client
        );
    }

    async handle({
        aoMessage,
        parsedData,
        aoMessageId,
        aoRoomId,
    }): Promise<void> {
        const { owner, id } = aoMessage;
        const { payload, topic, id: taskId } = parsedData;
        const prompt = payload;

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
                `AO task could not be processed, no action with name ${topic}.`
            );
        }
        const userIdUUID = this.buildUserUUID(owner);
        await this.runtime.ensureConnection(
            userIdUUID,
            aoRoomId,
            owner.address,
            owner.address,
            "ao"
        );
        const memory = this.buildMemory(prompt, aoRoomId, userIdUUID);
        const state = await this.stateCompositionHandler.handle(
            aoMessage,
            prompt,
            memory
        );
        await this.saveAoTaskIfNeeded(
            aoMessage,
            aoRoomId,
            aoMessageId,
            prompt,
            state
        );
        await this.processTaskInActions(
            state,
            memory,
            aoMessage,
            aoRoomId,
            aoMessageId,
            prompt,
            topic,
            taskId
        );
    }

    private async saveAoTaskIfNeeded(
        aoMessage: NodeType,
        roomId: UUID,
        messageId: UUID,
        prompt: string,
        state: State
    ) {
        const { url, ingested_at } = aoMessage;
        const aoMessageExists =
            await this.runtime.messageManager.getMemoryById(messageId);

        if (!aoMessageExists) {
            elizaLogger.log("AO message does not exist, saving");
            const userIdUUID = stringToUuid(aoMessage.owner.address);

            const message = {
                id: messageId,
                agentId: this.runtime.agentId,
                content: {
                    text: prompt,
                    url: url,
                },
                userId: userIdUUID,
                roomId,
                createdAt: ingested_at * 1000,
            };
            this.client.saveRequestMessage(message, state);
        }
    }

    private async processTaskInActions(
        state: any,
        memory: any,
        aoMessage: NodeType,
        roomId: UUID,
        messageId: UUID,
        prompt: string,
        task: string,
        taskId: string
    ) {
        const { id } = aoMessage;
        const self = this;
        try {
            const callback: HandlerCallback = async (content: Content) => {
                await self.client.aoClient.sendTaskResult(taskId, content);
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
                    source: "AoTheComputer",
                    url: `https://www.ao.link/#/message/${id}`,
                    // inReplyTo: stringToUuid(
                    //     id + "-" + this.client.runtime.agentId
                    // ),
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

    private buildMemory(prompt: string, aoRoomId: UUID, userIdUUID: UUID) {
        return {
            content: { text: prompt },
            agentId: this.runtime.agentId,
            userId: userIdUUID,
            roomId: aoRoomId,
        };
    }

    private buildUserUUID(owner: { address: string }): UUID {
        return owner.address === this.walletId
            ? this.agentId
            : stringToUuid(owner.address!);
    }
}
