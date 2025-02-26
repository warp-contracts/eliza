import { elizaLogger, IAgentRuntime, stringToUuid, UUID } from "@elizaos/core";
import { ClaraTaskType } from "../../utils/claraTypes";
import { ClaraClient } from "../../ClaraClient";
import { ClaraTaskHandler } from "./ClaraTaskHandler";
import { ClaraTask } from "../ClaraTask";

export class ClaraMessageHandler extends ClaraTask {
    private claraTaskHandler: ClaraTaskHandler;
    private claraMessage: ClaraTaskType;
    constructor(runtime: IAgentRuntime, client: ClaraClient) {
        super(client, runtime);
        this.claraTaskHandler = new ClaraTaskHandler(this.client, this.runtime);
    }

    async handle(claraMessage: ClaraTaskType) {
        this.claraMessage = claraMessage;
        const { id, payload } = this.claraMessage;
        const claraMessageId = stringToUuid(id);
        const claraRoomId = stringToUuid(id + "-" + this.agentId);
        elizaLogger.info(`Started processing Clara message: ${id}.`);
        const valid = await this.validate();
        if (!valid) {
            this.client.updateLastCheckedMessage(this.claraMessage);
            return;
        }
        if (!payload) {
            elizaLogger.log(`Skipping Clara message, could not locate prompt.`);
            this.client.updateLastCheckedMessage(this.claraMessage);
            return;
        }
        await this.claraTaskHandler.handle({
            claraMessage,
            claraMessageId,
            claraRoomId,
        });
        elizaLogger.info(`Finished processing Clara message ${id}.`);
    }

    private async validate(): Promise<boolean> {
        const { requester } = this.claraMessage;
        if (requester === this.walletId) {
            elizaLogger.log(
                `Skipping Clara message, message from current agent.`
            );
            return false;
        }

        let messageCursor: number;
        switch (this.client.claraConfig.CLARA_IMPL) {
            case "ao":
                messageCursor = this.claraMessage.timestamp;
                break;
            case "story":
                messageCursor = Number(this.claraMessage.blockNumber);
                break;
            default:
                throw new Error(
                    `Unknown Clara impl: ${this.client.claraConfig.CLARA_IMPL}`
                );
        }
        if (this.client.lastCheckedMessage >= messageCursor) {
            elizaLogger.log(`Skipping Clara message, already processed task.`);
            return false;
        }
        return true;
    }
}
