import { elizaLogger } from "@elizaos/core";
import { NodeType } from "../../ao_types";
import { ClientBase } from "../../base";

const INCOMING_MESSAGES_TO_COUNT = 5;

export class AoFetchMessageHandler {
    constructor(private client: ClientBase) {}

    async handle(): Promise<NodeType[]> {
        const messages = await this.client.fetchIncomingMessages(
            INCOMING_MESSAGES_TO_COUNT
        );

        elizaLogger.log(
            "Completed checking incoming messages",
            this.client.lastCheckedMessageTs,
            messages.length
        );

        return messages.sort(
            (a: NodeType, b: NodeType) => a.ingested_at - b.ingested_at
        );
    }
}
