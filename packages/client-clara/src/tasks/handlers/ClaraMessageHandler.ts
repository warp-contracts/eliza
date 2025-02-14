import { elizaLogger, IAgentRuntime, stringToUuid, UUID } from "@elizaos/core";
import { ClaraTaskType } from "../../utils/claraTypes";
import { ClientBase } from "../../base";
import { ClaraTaskHandler } from "./ClaraTaskHandler";
import { ClaraTask } from "../ClaraTask";

export class ClaraMessageHandler extends ClaraTask {
    private claraTaskHandler: ClaraTaskHandler;
    private claraMessage: ClaraTaskType;
    constructor(runtime: IAgentRuntime, client: ClientBase) {
        super(client, runtime);
        this.claraTaskHandler = new ClaraTaskHandler(this.client, this.runtime);
    }

    async handle(claraMessage: ClaraTaskType) {
        this.claraMessage = claraMessage;
        const { id, payload } = this.claraMessage;
        const claraMessageId = stringToUuid(id);
        const claraRoomId = stringToUuid(id + "-" + this.agentId);

        elizaLogger.log(`Started processing Clara message: ${id}.`);
        const valid = await this.validate(claraMessageId);
        if (!valid) {
            this.updateLastCheckedMessage();
            return;
        }
        if (!payload) {
            elizaLogger.log(`Skipping Clara message, could not locate prompt.`);
            this.updateLastCheckedMessage();
            return;
        }

        await this.claraTaskHandler.handle({
            claraMessage,
            claraMessageId,
            claraRoomId,
        });
        this.updateLastCheckedMessage();
        elizaLogger.log(`Finished processing Clara message ${id}.`);
    }

    private updateLastCheckedMessage() {
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao":
                this.client.lastCheckedMessage = this.claraMessage.timestamp;
                break;
            case "story":
                this.client.lastCheckedMessage = Number(
                    this.claraMessage.cursor
                );
                break;
            default:
                throw new Error(
                    `Unknown Clara impl: ${this.client.claraConfig.CLARA_IMPL}`
                );
        }
    }

    private async validate(claraMessageId: UUID): Promise<boolean> {
        const { requester } = this.claraMessage;
        if (requester === this.walletId) {
            elizaLogger.log(
                `Skipping Clara message, message from current agent.`
            );
            return false;
        }

        const existingResponse =
            await this.runtime.messageManager.getMemoryById(claraMessageId);
        if (existingResponse) {
            elizaLogger.log(`Skipping Clara message, already processed task.`);
            return false;
        }
        return true;
    }
}
