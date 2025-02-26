import { elizaLogger, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ClaraTaskType } from "../../utils/claraTypes";
import { ClaraClient } from "../../ClaraClient";
import { ClaraTask } from "../ClaraTask";
import { buildConversationThread } from "../../utils/utils";

export class ClaraStateCompositionHandler extends ClaraTask {
    constructor(runtime: IAgentRuntime, client: ClaraClient) {
        super(client, runtime);
    }

    async handle(
        claraMessage: ClaraTaskType,
        prompt: string,
        memory: Memory
    ): Promise<State> {
        const currentMessage = this.formatMessage(claraMessage, prompt);
        const thread = await buildConversationThread(
            claraMessage,
            prompt,
            this.client
        );
        elizaLogger.info("Thread: ", thread);
        const formattedConversation = thread
            .map(
                (message) => `@${message.requester} (${new Date(
                    message.timestamp
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
            `Formated conversation for message id: ${claraMessage.id}`,
            formattedConversation
        );
        return await this.runtime.composeState(memory, {
            claraClient: this.client,
            claraUserName: this.client.claraConfig.CLARA_USERNAME,
            currentMessage,
            formattedConversation,
            recentPostInteractions: [formattedConversation],
        });
    }

    formatMessage(claraMessage: ClaraTaskType, prompt: string) {
        return `  ID: ${claraMessage.id}
  From: ${claraMessage.requester} (@${claraMessage.requester})
  Text: ${prompt}`;
    }
}
