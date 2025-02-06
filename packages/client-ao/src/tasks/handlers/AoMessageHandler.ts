import { elizaLogger, IAgentRuntime, stringToUuid, UUID } from "@elizaos/core";
import { AoTaskType } from "../../ao_types";
import { ClientBase } from "../../base";
import { AoTaskHandler } from "./AoTaskHandler";
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
        if (!payload) {
            elizaLogger.log(`Skipping AO message, could not locate prompt.`);
            this.updateLastCheckedMessage();
            return;
        }

        await this.aoTaskHandler.handle({
            aoMessage,
            aoMessageId,
            aoRoomId,
        });
        this.updateLastCheckedMessage();
        elizaLogger.log(`Finished processing AO message ${id}.`);
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

        const existingResponse =
            await this.runtime.messageManager.getMemoryById(aoMessageId);
        if (existingResponse) {
            elizaLogger.log(`Skipping AO message, already processed task.`);
            return false;
        }
        return true;
    }
}
