import { Tweet } from "agent-twitter-client";
import { getEmbeddingZeroVector } from "@elizaos/core";
import { Content, Memory, UUID } from "@elizaos/core";
import { stringToUuid } from "@elizaos/core";
import { ClientBase } from "./base";
import { elizaLogger } from "@elizaos/core";
import { Media } from "@elizaos/core";
import fs from "fs";
import path from "path";
import {NodeType} from "./ao_types.ts";

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export async function buildConversationThread(
    aoMessage: NodeType,
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
            elizaLogger.debug("No current tweet found for thread building");
            return;
        }

        // Stop if we've reached our reply limit
        if (depth >= maxReplies) {
            elizaLogger.debug("Reached maximum reply depth", depth);
            return;
        }

        // Handle memory storage
        const memory = await client.runtime.messageManager.getMemoryById(
            stringToUuid(currentMessage.id + "-" + client.runtime.agentId)
        );
        if (!memory) {
            const roomId = stringToUuid(
                currentMessage.conversationId + "-" + client.runtime.agentId
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
                id: stringToUuid(currentMessage.id + "-" + client.runtime.agentId),
                agentId: client.runtime.agentId,
                content: {
                    text: currentMessage.data.value,
                    source: "AoTheComputer",
                    url: currentMessage.conversationId,
                },
                createdAt: currentMessage.timestamp * 1000,
                roomId,
                userId:
                    currentMessage.owner.address === client.profile.Owner
                        ? client.runtime.agentId
                        : stringToUuid(currentMessage.owner.address),
                embedding: getEmbeddingZeroVector(),
            });
        }

        if (visited.has(currentMessage.id)) {
            elizaLogger.debug("Already visited tweet:", currentMessage.id);
            return;
        }

        visited.add(currentMessage.id);
        thread.unshift(currentMessage);

        elizaLogger.debug("Current thread state:", {
            length: thread.length,
            currentDepth: depth,
            tweetId: currentMessage.id,
        });
    }

    await processThread(aoMessage, 0);

    elizaLogger.debug("Final thread built:", {
        totalMessages: thread.length,
        tweetIds: thread.map((t) => ({
            id: t.id,
            text: t.data?.value?.slice(0, 50),
        })),
    });

    return thread;
}

export async function sendMessage(
    client: ClientBase,
    content: Content,
    roomId: UUID,
    twitterUsername: string,
    inReplyTo: string
): Promise<Memory[]> {
    const maxMessageLength = client.aoConfig.AO_MAX_MESSAGE_LENGTH;

    const messageChunks = splitMessageContent(content.text, maxMessageLength);
    const sentTweets: Tweet[] = [];
    let previousTweetId = inReplyTo;

    for (const chunk of messageChunks) {
        let mediaData: { data: Buffer; mediaType: string }[] | undefined;

        if (content.attachments && content.attachments.length > 0) {
            mediaData = await Promise.all(
                content.attachments.map(async (attachment: Media) => {
                    if (/^(http|https):\/\//.test(attachment.url)) {
                        // Handle HTTP URLs
                        const response = await fetch(attachment.url);
                        if (!response.ok) {
                            throw new Error(
                                `Failed to fetch file: ${attachment.url}`
                            );
                        }
                        const mediaBuffer = Buffer.from(
                            await response.arrayBuffer()
                        );
                        const mediaType = attachment.contentType;
                        return { data: mediaBuffer, mediaType };
                    } else if (fs.existsSync(attachment.url)) {
                        // Handle local file paths
                        const mediaBuffer = await fs.promises.readFile(
                            path.resolve(attachment.url)
                        );
                        const mediaType = attachment.contentType;
                        return { data: mediaBuffer, mediaType };
                    } else {
                        throw new Error(
                            `File not found: ${attachment.url}. Make sure the path is correct.`
                        );
                    }
                })
            );
        }
        const result = await client.requestQueue.add(async () => client.aoClient.sendAoMessage(chunk.trim(), previousTweetId, mediaData));

        const body = await result.json();
        const tweetResult = body.data.create_tweet.tweet_results.result;

        // if we have a response
        if (tweetResult) {
            // Parse the response
            const finalTweet: Tweet = {
                id: tweetResult.rest_id,
                text: tweetResult.legacy.full_text,
                conversationId: tweetResult.legacy.conversation_id_str,
                timestamp:
                    new Date(tweetResult.legacy.created_at).getTime() / 1000,
                userId: tweetResult.legacy.user_id_str,
                inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
                permanentUrl: `https://ao.link/${twitterUsername}/status/${tweetResult.rest_id}`,
                hashtags: [],
                mentions: [],
                photos: [],
                thread: [],
                urls: [],
                videos: [],
            };
            sentTweets.push(finalTweet);
            previousTweetId = finalTweet.id;
        } else {
            elizaLogger.error("Error sending tweet chunk:", { chunk, response: body });
        }

        // Wait a bit between tweets to avoid rate limiting issues
        await wait(1000, 2000);
    }

    const memories: Memory[] = sentTweets.map((tweet) => ({
        id: stringToUuid(tweet.id + "-" + client.runtime.agentId),
        agentId: client.runtime.agentId,
        userId: client.runtime.agentId,
        content: {
            text: tweet.text,
            source: "AoTheComputer",
            url: tweet.permanentUrl,
            inReplyTo: tweet.inReplyToStatusId
                ? stringToUuid(
                      tweet.inReplyToStatusId + "-" + client.runtime.agentId
                  )
                : undefined,
        },
        roomId,
        embedding: getEmbeddingZeroVector(),
        createdAt: tweet.timestamp * 1000,
    }));

    return memories;
}

function splitMessageContent(content: string, maxLength: number): string[] {
    const paragraphs = content.split("\n\n").map((p) => p.trim());
    const tweets: string[] = [];
    let currentTweet = "";

    for (const paragraph of paragraphs) {
        if (!paragraph) continue;

        if ((currentTweet + "\n\n" + paragraph).trim().length <= maxLength) {
            if (currentTweet) {
                currentTweet += "\n\n" + paragraph;
            } else {
                currentTweet = paragraph;
            }
        } else {
            if (currentTweet) {
                tweets.push(currentTweet.trim());
            }
            if (paragraph.length <= maxLength) {
                currentTweet = paragraph;
            } else {
                // Split long paragraph into smaller chunks
                const chunks = splitParagraph(paragraph, maxLength);
                tweets.push(...chunks.slice(0, -1));
                currentTweet = chunks[chunks.length - 1];
            }
        }
    }

    if (currentTweet) {
        tweets.push(currentTweet.trim());
    }

    return tweets;
}

function splitParagraph(paragraph: string, maxLength: number): string[] {
    // eslint-disable-next-line
    const sentences = paragraph.match(/[^\.!\?]+[\.!\?]+|[^\.!\?]+$/g) || [
        paragraph,
    ];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if ((currentChunk + " " + sentence).trim().length <= maxLength) {
            if (currentChunk) {
                currentChunk += " " + sentence;
            } else {
                currentChunk = sentence;
            }
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            if (sentence.length <= maxLength) {
                currentChunk = sentence;
            } else {
                // Split long sentence into smaller pieces
                const words = sentence.split(" ");
                currentChunk = "";
                for (const word of words) {
                    if (
                        (currentChunk + " " + word).trim().length <= maxLength
                    ) {
                        if (currentChunk) {
                            currentChunk += " " + word;
                        } else {
                            currentChunk = word;
                        }
                    } else {
                        if (currentChunk) {
                            chunks.push(currentChunk.trim());
                        }
                        currentChunk = word;
                    }
                }
            }
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}
