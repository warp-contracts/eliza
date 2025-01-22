import { elizaLogger, IAgentRuntime, Memory, State } from "@elizaos/core";
import { NodeType } from "../../ao_types";
import { ClientBase } from "../../base";
import { AoTask } from "../AoTask";
import { buildConversationThread } from "../../utils";

export class AoStateCompositionHandler extends AoTask {
    constructor(runtime: IAgentRuntime, client: ClientBase) {
        super(client, runtime);
    }

    async handle(
        aoMessage: NodeType,
        prompt: string,
        memory: Memory
    ): Promise<State> {
        const currentMessage = this.formatMessage(aoMessage, prompt);
        const thread = await buildConversationThread(
            aoMessage,
            prompt,
            this.client
        );
        elizaLogger.info("Thread: ", thread);
        const formattedConversation = thread
            .map(
                (message) => `@${message.owner.address} (${new Date(
                    message.ingested_at * 1000
                ).toLocaleString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                })}):
        ${prompt}`
            )
            .join("\n\n");

        elizaLogger.info(
            `Formated conversation for message id: ${aoMessage.id}`,
            formattedConversation
        );
        return await this.runtime.composeState(memory, {
            aoClient: this.client.aoClient,
            aoUserName: this.client.aoConfig.AO_USERNAME,
            currentMessage,
            formattedConversation,
            recentPostInteractions: [formattedConversation],
        });
    }

    formatMessage(aoMessage: NodeType, prompt: string) {
        return `  ID: ${aoMessage.id}
  From: ${aoMessage.owner.address} (@${aoMessage.owner.address})
  Text: ${prompt}`;
    }
}
