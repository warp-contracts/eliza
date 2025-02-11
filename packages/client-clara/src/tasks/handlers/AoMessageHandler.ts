import { elizaLogger, IAgentRuntime, stringToUuid, UUID } from "@elizaos/core";
import { ClaraTaskType } from "../../ao_types";
import { ClientBase } from "../../base";
import { AoTaskHandler } from "./AoTaskHandler";
import { AoTask } from "../AoTask";

export class AoMessageHandler extends AoTask {
    private aoTaskHandler: AoTaskHandler;
    private aoMessage: ClaraTaskType;
    constructor(runtime: IAgentRuntime, client: ClientBase) {
        super(client, runtime);
        this.aoTaskHandler = new AoTaskHandler(this.client, this.runtime);
    }

    async handle(aoMessage: ClaraTaskType) {
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
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao":
                this.client.lastCheckedMessageTs = this.aoMessage.timestamp;
                break;
            case "story":
                this.client.lastCheckedMessageTs = Number(
                    this.aoMessage.cursor
                );
                break;
            default:
                throw new Error(
                    `Unknown Clara impl: ${this.client.claraConfig.CLARA_IMPL}`
                );
        }
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
