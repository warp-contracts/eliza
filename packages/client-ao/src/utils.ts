import { getEmbeddingZeroVector } from "@elizaos/core";
import { stringToUuid } from "@elizaos/core";
import { ClientBase } from "./base";
import { elizaLogger } from "@elizaos/core";
import { NodeType } from "./ao_types.ts";

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export async function buildConversationThread(
    aoMessage: NodeType,
    prompt: string,
    client: ClientBase,
    maxReplies: number = 10
): Promise<NodeType[]> {
    const thread: NodeType[] = [];
    const visited: Set<string> = new Set();

    async function processThread(currentMessage: NodeType, depth: number = 0) {
        elizaLogger.debug("Processing message:", {
            id: currentMessage.id,
            depth: depth,
        });

        if (!currentMessage) {
            elizaLogger.debug("No current message found for thread building");
            return;
        }

        // Stop if we've reached our reply limit
        if (depth >= maxReplies) {
            elizaLogger.debug("Reached maximum reply depth", depth);
            return;
        }

        // Handle memory storage
        const memory = await client.runtime.messageManager.getMemoryById(
            stringToUuid(currentMessage.id)
        );
        if (!memory) {
            const roomId = stringToUuid(
                currentMessage.id + "-" + client.runtime.agentId
            );
            const userId = stringToUuid(currentMessage.owner.address);

            await client.runtime.ensureConnection(
                userId,
                roomId,
                currentMessage.owner.address,
                currentMessage.owner.address,
                "ao"
            );

            await client.runtime.messageManager.createMemory({
                id: stringToUuid(
                    currentMessage.id + "-" + client.runtime.agentId
                ),
                agentId: client.runtime.agentId,
                content: {
                    text: prompt,
                    source: "AoTheComputer",
                    url: currentMessage.id,
                },
                createdAt: currentMessage.ingested_at * 1000,
                roomId,
                userId:
                    currentMessage.owner.address === client.walletId
                        ? client.runtime.agentId
                        : stringToUuid(currentMessage.owner.address),
                embedding: getEmbeddingZeroVector(),
            });
        }

        if (visited.has(currentMessage.id)) {
            elizaLogger.debug("Already visited message:", currentMessage.id);
            return;
        }

        visited.add(currentMessage.id);
        thread.unshift(currentMessage);

        elizaLogger.debug("Current thread state:", {
            length: thread.length,
            currentDepth: depth,
            messageId: currentMessage.id,
        });
    }

    await processThread(aoMessage, 0);

    elizaLogger.debug("Final thread built:", {
        totalMessages: thread.length,
        messageIds: thread.map((t) => ({
            id: t.id,
            text: t.data?.value?.slice(0, 50),
        })),
    });

    return thread;
}

