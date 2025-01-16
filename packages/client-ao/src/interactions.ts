import { Tweet } from "agent-twitter-client";
import {
    composeContext,
    generateMessageResponse,
    generateShouldRespond,
    messageCompletionFooter,
    shouldRespondFooter,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    stringToUuid,
    elizaLogger,
    getEmbeddingZeroVector,
} from "@elizaos/core";
import { ClientBase } from "./base";
import { buildConversationThread, sendMessage, wait } from "./utils.ts";
import { NodeType } from "./ao_types.ts";
import { AoTheComputerPostClient } from "./post.ts";

export const aoMessageHandlerTemplate =
    `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{aoUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

{{recentPosts}}

# TASK: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{aoUserName}}) while using the thread of messages as additional context:

Current Post:
{{currentPost}}

Thread of Messages You Are Replying To:
{{formattedConversation}}

# INSTRUCTIONS: Generate a post in the voice, style and perspective of {{agentName}} (@{{aoUserName}}). You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actionNames}}
{{actions}}

Here is the current post text again. Remember to include an action if the current post text includes a prompt that asks for one of the available actions mentioned above (does not need to be exact)
{{currentPost}}
` + messageCompletionFooter;

export const aoShouldRespondTemplate =
    `# INSTRUCTIONS: Determine if {{agentName}} (@{{aoUserName}}) should respond to the message and participate in the conversation. Do not comment. Just respond with "true" or "false".

Response options are RESPOND, IGNORE and STOP.

For other users:
- {{agentName}} should RESPOND to messages directed at them
- {{agentName}} should RESPOND to conversations relevant to their background
- {{agentName}} should IGNORE irrelevant messages
- {{agentName}} should IGNORE very short messages unless directly addressed
- {{agentName}} should STOP if asked to stop
- {{agentName}} should STOP if conversation is concluded
- {{agentName}} is in a room with other users and wants to be conversational, but not annoying.

IMPORTANT:
- {{agentName}} (aka @{{aoUserName}}) is particularly sensitive about being annoying, so if there is any doubt, it is better to IGNORE than to RESPOND.
- For users not in the priority list, {{agentName}} (@{{aoUserName}}) should err on the side of IGNORE rather than RESPOND if in doubt.

Recent Posts:
{{recentPosts}}

Current Post:
{{currentPost}}

Thread of Tweets You Are Replying To:
{{formattedConversation}}

# INSTRUCTIONS: Respond with [RESPOND] if {{agentName}} should respond, or [IGNORE] if {{agentName}} should not respond to the last message and [STOP] if {{agentName}} should stop participating in the conversation.
` + shouldRespondFooter;

export class AoInteractionClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    postClient: AoTheComputerPostClient;
    constructor(
        client: ClientBase,
        runtime: IAgentRuntime,
        postClient: AoTheComputerPostClient
    ) {
        this.client = client;
        this.runtime = runtime;
        this.postClient = postClient;
    }

    async start() {
        const handleAoInteractionsLoop = () => {
            this.handleAoInteractions();
            setTimeout(
                handleAoInteractionsLoop,
                // Defaults to 2 minutes
                this.client.aoConfig.AO_POLL_INTERVAL * 1000
            );
        };
        handleAoInteractionsLoop();
    }

    async handleAoInteractions() {
        elizaLogger.log("Checking AO interactions");

        try {
            const messages = await this.client.fetchIncomingMessages(20);

            elizaLogger.log(
                "Completed checking incoming messages",
                messages.length
            );

            // Sort tweet candidates by ID in ascending order
            messages.sort((a, b) => a.timestamp - b.timestamp);

            // for each message candidate, handle the message
            for (const m of messages) {
                if (
                    !this.client.lastCheckedMessageTs ||
                    m.timestamp > this.client.lastCheckedMessageTs
                ) {
                    // Generate the messageId UUID the same way it's done in handleAoMessage
                    const messageId = stringToUuid(m.id);

                    // Check if we've already processed this message
                    const existingResponse =
                        await this.runtime.messageManager.getMemoryById(
                            messageId
                        );

                    if (existingResponse) {
                        elizaLogger.log(
                            `Already responded to message ${m.id}, skipping`
                        );
                        continue;
                    }

                    const roomId = stringToUuid(
                        m.conversationId + "-" + this.runtime.agentId
                    );

                    const userIdUUID =
                        m.owner.address === this.client.profile.Owner
                            ? this.runtime.agentId
                            : stringToUuid(m.owner.address!);

                    await this.runtime.ensureConnection(
                        userIdUUID,
                        roomId,
                        m.owner.address,
                        m.owner.address,
                        "ao"
                    );

                    const thread = await buildConversationThread(
                        m,
                        this.client
                    );

                    const memory = {
                        content: { text: m.data.value },
                        agentId: this.runtime.agentId,
                        userId: userIdUUID,
                        roomId,
                    };

                    // in the end I guess here should be logic for handling missions
                    if (m.data.value.includes(`Eliza`)) {
                        elizaLogger.info(`Replying to message: ${m.id}.`);
                        this.postClient.postMessage(
                            this.runtime,
                            this.client,
                            m.data.value,
                            roomId,
                            m.data.value,
                            process.env.AO_USERNAME
                        );
                    }

                    // Update the last checked message timestamp after processing each message
                    this.client.lastCheckedMessageTs = m.timestamp;
                }
            }

            // Save the latest checked message timestamp to the file
            await this.client.cacheLatestCheckedMessageTimestamp();

            elizaLogger.log("Finished checking AO interactions");
        } catch (error) {
            console.log(error);
            elizaLogger.error("Error handling AO interactions:", error);
        }
    }

    private async handleAoMessage({
        aoMessage,
        memory,
        thread,
    }: {
        aoMessage: NodeType;
        memory: Memory;
        thread: NodeType[];
    }) {
        if (aoMessage.owner.address === this.client.profile.Owner) {
            // Skip processing if the memory is from the bot itself
            return;
        }

        if (!memory.content.text) {
            elizaLogger.log("Skipping Tweet with no text", aoMessage.id);
            return { text: "", action: "IGNORE" };
        }

        elizaLogger.log("Processing Tweet: ", aoMessage.id);
        const formatMessage = (tweet: NodeType) => {
            return `  ID: ${tweet.id}
  From: ${tweet.owner.address} (@${tweet.owner.address})
  Text: ${tweet.data.value}`;
        };
        const currentPost = formatMessage(aoMessage);

        elizaLogger.debug("Thread: ", thread);
        const formattedConversation = thread
            .map(
                (message) => `@${message.owner.address} (${new Date(
                    message.timestamp * 1000
                ).toLocaleString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                })}):
        ${message.data.value}`
            )
            .join("\n\n");

        elizaLogger.debug("formattedConversation: ", formattedConversation);

        let state = await this.runtime.composeState(memory, {
            aoClient: this.client.aoClient,
            aoUserName: this.client.aoConfig.AO_USERNAME,
            currentPost,
            formattedConversation,
        });

        // check if the tweet exists, save if it doesn't
        const tweetId = stringToUuid(aoMessage.id + "-" + this.runtime.agentId);
        const tweetExists =
            await this.runtime.messageManager.getMemoryById(tweetId);

        if (!tweetExists) {
            elizaLogger.log("tweet does not exist, saving");
            const userIdUUID = stringToUuid(aoMessage.owner.address);
            const roomId = stringToUuid(aoMessage.conversationId);

            const message = {
                id: tweetId,
                agentId: this.runtime.agentId,
                content: {
                    text: aoMessage.data.value,
                    url: aoMessage.url,
                },
                userId: userIdUUID,
                roomId,
                createdAt: aoMessage.timestamp * 1000,
            };
            this.client.saveRequestMessage(message, state);
        }

        const template =
            this.runtime.character.templates?.aoShouldRespondTemplate ||
            this.runtime.character?.templates?.shouldRespondTemplate ||
            aoShouldRespondTemplate;
        const shouldRespondContext = composeContext({
            state,
            template,
        });

        const shouldRespond = await generateShouldRespond({
            runtime: this.runtime,
            context: shouldRespondContext,
            modelClass: ModelClass.MEDIUM,
        });

        // Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
        if (shouldRespond !== "RESPOND") {
            elizaLogger.log("Not responding to message");
            return { text: "Response Decision:", action: shouldRespond };
        }

        const context = composeContext({
            state,
            template:
                this.runtime.character.templates?.aoMessageHandlerTemplate ||
                this.runtime.character?.templates?.messageHandlerTemplate ||
                aoMessageHandlerTemplate,
        });

        elizaLogger.debug("Interactions prompt:\n" + context);

        const response = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        const removeQuotes = (str: string) =>
            str.replace(/^['"](.*)['"]$/, "$1");

        const stringId = stringToUuid(
            aoMessage.id + "-" + this.runtime.agentId
        );

        response.inReplyTo = stringId;

        response.text = removeQuotes(response.text);

        if (response.text) {
            try {
                const callback: HandlerCallback = async (response: Content) => {
                    const memories = await sendMessage(
                        this.client,
                        response,
                        memory.roomId,
                        this.client.aoConfig.AO_PROFILE_CONTRACT,
                        aoMessage.id
                    );
                    return memories;
                };

                const responseMessages = await callback(response);

                state = (await this.runtime.updateRecentMessageState(
                    state
                )) as State;

                for (const responseMessage of responseMessages) {
                    if (
                        responseMessage ===
                        responseMessages[responseMessages.length - 1]
                    ) {
                        responseMessage.content.action = response.action;
                    } else {
                        responseMessage.content.action = "CONTINUE";
                    }
                    await this.runtime.messageManager.createMemory(
                        responseMessage
                    );
                }

                await this.runtime.processActions(
                    memory,
                    responseMessages,
                    state,
                    callback
                );

                const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${aoMessage.id} - ${aoMessage.owner.address}: ${aoMessage.data.value}\nAgent's Output:\n${response.text}`;

                await this.runtime.cacheManager.set(
                    `ao/tweet_generation_${aoMessage.id}.txt`,
                    responseInfo
                );
                await wait();
            } catch (error) {
                elizaLogger.error(`Error sending response tweet: ${error}`);
            }
        }
    }

    async buildConversationThread(
        tweet: Tweet,
        maxReplies: number = 10
    ): Promise<Tweet[]> {
        const thread: Tweet[] = [];
        const visited: Set<string> = new Set();

        async function processThread(currentTweet: Tweet, depth: number = 0) {
            elizaLogger.log("Processing tweet:", {
                id: currentTweet.id,
                inReplyToStatusId: currentTweet.inReplyToStatusId,
                depth: depth,
            });

            if (!currentTweet) {
                elizaLogger.log("No current tweet found for thread building");
                return;
            }

            if (depth >= maxReplies) {
                elizaLogger.log("Reached maximum reply depth", depth);
                return;
            }

            // Handle memory storage
            const memory = await this.runtime.messageManager.getMemoryById(
                stringToUuid(currentTweet.id + "-" + this.runtime.agentId)
            );
            if (!memory) {
                const roomId = stringToUuid(
                    currentTweet.conversationId + "-" + this.runtime.agentId
                );
                const userId = stringToUuid(currentTweet.userId);

                await this.runtime.ensureConnection(
                    userId,
                    roomId,
                    currentTweet.username,
                    currentTweet.name,
                    "ao"
                );

                this.runtime.messageManager.createMemory({
                    id: stringToUuid(
                        currentTweet.id + "-" + this.runtime.agentId
                    ),
                    agentId: this.runtime.agentId,
                    content: {
                        text: currentTweet.text,
                        source: "AoTheComputer",
                        url: currentTweet.permanentUrl,
                        inReplyTo: currentTweet.inReplyToStatusId
                            ? stringToUuid(
                                  currentTweet.inReplyToStatusId +
                                      "-" +
                                      this.runtime.agentId
                              )
                            : undefined,
                    },
                    createdAt: currentTweet.timestamp * 1000,
                    roomId,
                    userId:
                        currentTweet.userId === this.aoUserId
                            ? this.runtime.agentId
                            : stringToUuid(currentTweet.userId),
                    embedding: getEmbeddingZeroVector(),
                });
            }

            if (visited.has(currentTweet.id)) {
                elizaLogger.log("Already visited tweet:", currentTweet.id);
                return;
            }

            visited.add(currentTweet.id);
            thread.unshift(currentTweet);

            elizaLogger.debug("Current thread state:", {
                length: thread.length,
                currentDepth: depth,
                tweetId: currentTweet.id,
            });

            if (currentTweet.inReplyToStatusId) {
                elizaLogger.log(
                    "Fetching parent tweet:",
                    currentTweet.inReplyToStatusId
                );
                try {
                    const parentTweet = await this.aoClient.getTweet(
                        currentTweet.inReplyToStatusId
                    );

                    if (parentTweet) {
                        elizaLogger.log("Found parent tweet:", {
                            id: parentTweet.id,
                            text: parentTweet.text?.slice(0, 50),
                        });
                        await processThread(parentTweet, depth + 1);
                    } else {
                        elizaLogger.log(
                            "No parent tweet found for:",
                            currentTweet.inReplyToStatusId
                        );
                    }
                } catch (error) {
                    elizaLogger.log("Error fetching parent tweet:", {
                        tweetId: currentTweet.inReplyToStatusId,
                        error,
                    });
                }
            } else {
                elizaLogger.log(
                    "Reached end of reply chain at:",
                    currentTweet.id
                );
            }
        }

        // Need to bind this context for the inner function
        await processThread.bind(this)(tweet, 0);

        elizaLogger.debug("Final thread built:", {
            totalTweets: thread.length,
            tweetIds: thread.map((t) => ({
                id: t.id,
                text: t.text?.slice(0, 50),
            })),
        });

        return thread;
    }
}
