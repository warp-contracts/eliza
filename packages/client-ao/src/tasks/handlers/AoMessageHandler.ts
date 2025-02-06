import { elizaLogger, IAgentRuntime, stringToUuid, UUID } from "@elizaos/core";
import { AoTaskType, NodeDataType, NodeType, TagType } from "../../ao_types";
import { ClientBase } from "../../base";
import { AoTaskHandler } from "./AoTaskHandler";
import { AO_TASK_ASSIGNMENT_TAG_NAME } from "../AoTaskClient";
import { AoTask } from "../AoTask";

export class AoMessageHandler extends AoTask {
    private aoTaskHandler: AoTaskHandler;
    private aoMessage: AoTaskType;
    constructor(runtime: IAgentRuntime, client: ClientBase) {
        super(client, runtime);
        this.aoTaskHandler = new AoTaskHandler(this.client, this.runtime);
    }

    async handle(aoMessage: AoTaskType) {
        this.aoMessage = aoMessage;
        const { id, payload } = this.aoMessage;
        const aoMessageId = stringToUuid(id);
        const aoRoomId = stringToUuid(id + "-" + this.agentId);

        elizaLogger.log(`Started processing AO message: ${id}.`);
        const valid = await this.validate(aoMessageId);
        if (!valid) {
            this.updateLastCheckedMessage();
            return;
        }
        // const parsedData = this.getAoMessageParsedData(data);
        // if (!parsedData) {
        //     elizaLogger.log(`Skipping AO message, could not parse data.`);
        //     this.updateLastCheckedMessage();
        //     return;
        // }
        // const prompt = payload;
        if (!payload) {
            elizaLogger.log(`Skipping AO message, could not locate prompt.`);
            this.updateLastCheckedMessage();
            return;
        }

        await this.aoTaskHandler.handle({
            aoMessage,
            // parsedData,
            aoMessageId,
            aoRoomId,
        });
        this.updateLastCheckedMessage();
        elizaLogger.log(`Finished processing AO message ${id}.`);
    }

    private getAoMessageParsedData(data: NodeDataType): any {
        if (data?.value) {
            try {
                return JSON.parse(data.value);
            } catch (e) {
                elizaLogger.error(`Could not parse payload data.`);
                return null;
            }
        }
        return null;
    }

    private updateLastCheckedMessage() {
        this.client.lastCheckedMessageTs = this.aoMessage.timestamp;
    }

    private async validate(aoMessageId: UUID): Promise<boolean> {
        const { requester } = this.aoMessage;
        if (requester === this.walletId) {
            elizaLogger.log(`Skipping AO message, message from current agent.`);
            return false;
        }

        // const action = tags.find((t: TagType) => t.name == "Action")?.value;
        // if (!action || !(action == AO_TASK_ASSIGNMENT_TAG_NAME)) {
        //     elizaLogger.log(`Skipping AO message, no "Task-Assignment" tag.`);
        //     return false;
        // }

        const existingResponse =
            await this.runtime.messageManager.getMemoryById(aoMessageId);
        if (existingResponse) {
            elizaLogger.log(`Skipping AO message, already processed task.`);
            return false;
        }
        return true;
    }
}
