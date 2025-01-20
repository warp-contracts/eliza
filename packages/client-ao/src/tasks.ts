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
    Action,
} from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { buildConversationThread, wait } from "./utils.ts";
import { NodeType, TagType } from "./ao_types.ts";
import { time } from "console";

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

Recent tasks between {{agentName}} and other users:
{{recentPostTasks}}

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

export class AoTaskClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start() {
        const handleAoTasksLoop = () => {
            this.handleAoTasks();
            setTimeout(
                handleAoTasksLoop,
                // Defaults to 2 minutes
                this.client.aoConfig.AO_POLL_INTERVAL * 1000
            );
        };
        handleAoTasksLoop();
    }

    async handleAoTasks() {
        elizaLogger.log("Checking AO tasks");

        try {
            const messages = await this.client.fetchIncomingMessages(5);

            elizaLogger.log(
                "Completed checking incoming messages",
                this.client.lastCheckedMessageTs,
                messages.length
            );

            // Sort tweet candidates by ID in ascending order
            messages.sort((a, b) => a.ingested_at - b.ingested_at);

            // for each message candidate, handle the message
            for (const m of messages) {
                if (
                    !this.client.lastCheckedMessageTs ||
                    m.ingested_at > this.client.lastCheckedMessageTs
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
                        m.id + "-" + this.runtime.agentId
                    );

                    const userIdUUID =
                        m.owner.address === this.client.walletId
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

                    await this.handleAoMessage({
                        aoMessage: m,
                        memory,
                        thread,
                    });

                    // Update the last checked message timestamp after processing each message
                    this.client.lastCheckedMessageTs = m.ingested_at;
                }
            }

            // Save the latest checked message timestamp to the file
            await this.client.cacheLatestCheckedMessageTimestamp();

            elizaLogger.log("Finished checking AO tasks");
        } catch (error) {
            console.log(error);
            elizaLogger.error("Error handling AO tasks:", error);
        }
    }

    private async handleAoMessage({ aoMessage, memory, thread }) {
        const { owner, tags, data } = aoMessage;
        if (owner.address === this.client.walletId) {
            elizaLogger.info(
                `Skipping AO message, message from current agent.`
            );
            return;
        }
        const task = tags.find((t: TagType) => t.name == "Task")?.value;
        if (!task) {
            elizaLogger.info(`Skipping AO message, no "Task" tag.`);
            return;
        }
        if (!data.value) {
            elizaLogger.info(`Skipping AO message, no content.`);
            return;
        }
        if (!this.runtime.actions.find((a: Action) => a.name == task)) {
            elizaLogger.info(
                `Task could not be processed, no action with name ${task}.`
            );
            //TODO: sent message to AO
            return;
        }
        const state = await this.composeMessageState(aoMessage, thread, memory);
        await this.saveAoMessageIfNeeded(aoMessage, state);
        await this.processTaskInActions(state, memory, aoMessage, task);
    }

    private async composeMessageState(
        aoMessage: NodeType,
        thread: NodeType[],
        memory: Memory
    ) {
        console.log("memory", memory);
        const formatMessage = (aoMessage: NodeType) => {
            return `  ID: ${aoMessage.id}
  From: ${aoMessage.owner.address} (@${aoMessage.owner.address})
  Text: ${aoMessage.data.value}`;
        };
        const currentMessage = formatMessage(aoMessage);
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
        ${message.data.value}`
            )
            .join("\n\n");

        elizaLogger.info("formattedConversation: ", formattedConversation);
        return await this.runtime.composeState(memory, {
            aoClient: this.client.aoClient,
            aoUserName: this.client.aoConfig.AO_USERNAME,
            currentMessage,
            formattedConversation,
        });
    }

    private async saveAoMessageIfNeeded(aoMessage: NodeType, state: State) {
        const { id, data, url, ingested_at } = aoMessage;
        // check if the AO message exists, save if it doesn't
        const aoMessageId = stringToUuid(id + "-" + this.runtime.agentId);
        const aoMessageExists =
            await this.runtime.messageManager.getMemoryById(aoMessageId);

        if (!aoMessageExists) {
            elizaLogger.log("AO message does not exist, saving");
            const userIdUUID = stringToUuid(aoMessage.owner.address);
            const roomId = stringToUuid(aoMessage.id);

            const message = {
                id: aoMessageId,
                agentId: this.runtime.agentId,
                content: {
                    text: data.value,
                    url: url,
                },
                userId: userIdUUID,
                roomId,
                createdAt: ingested_at * 1000,
            };
            this.client.saveRequestMessage(message, state);
        }
    }

    private async processTaskInActions(
        state: any,
        memory: any,
        aoMessage: NodeType,
        task: string
    ) {
        const { id, data, ingested_at, url } = aoMessage;
        console.log(aoMessage);
        try {
            const callback: HandlerCallback = async (response: Content) => {
                return null;
            };
            const responseMessage: Memory = {
                id: stringToUuid(id + "-" + this.client.runtime.agentId),
                userId: this.client.runtime.agentId,
                agentId: this.client.runtime.agentId,
                createdAt: Date.now(),
                content: {
                    text: data.value,
                    action: task,
                    source: "AoTheComputer",
                    url: `https://www.ao.link/#/message/${id}`,
                    inReplyTo: stringToUuid(
                        id + "-" + this.client.runtime.agentId
                    ),
                },
                embedding: getEmbeddingZeroVector(),
                roomId: stringToUuid(id),
            };
            await this.runtime.messageManager.createMemory(responseMessage);
            state = (await this.runtime.updateRecentMessageState(
                state
            )) as State;
            await this.runtime.processActions(
                responseMessage,
                [responseMessage],
                state,
                callback
            );
            await wait();
        } catch (error) {
            elizaLogger.error(`Error sending response tweet: ${error}`);
        }
    }

    private async handleInteraction({
        aoMessage,
        memory,
        thread,
    }: {
        aoMessage: NodeType;
        memory: Memory;
        thread: NodeType[];
    }) {
        console.log(`===== handleAoMessage`);
        if (aoMessage.owner.address === this.client.walletId) {
            console.log(`===== handleAoMessage - own message`);
            // Skip processing if the memory is from the bot itself
            return;
        }

        if (!memory.content.text) {
            elizaLogger.log("Skipping Tweet with no text", aoMessage.id);
            console.log(`===== handleAoMessage - no text`);
            return { text: "", action: "IGNORE" };
        }

        const task = aoMessage.tags.find(
            (t: TagType) => t.name == "Task"
        )?.value;
        if (!task) {
            elizaLogger.info(`Skipping AO message, no "Task" tag.`);
            return;
        }

        elizaLogger.log("Processing Message: ", aoMessage.id);
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
                    message.ingested_at
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
            const roomId = stringToUuid(aoMessage.id);

            const message = {
                id: tweetId,
                agentId: this.runtime.agentId,
                content: {
                    text: aoMessage.data.value,
                    // url: aoMessage.url,
                },
                userId: userIdUUID,
                roomId,
                createdAt: aoMessage.ingested_at * 1000,
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

        elizaLogger.debug("Tasks prompt:\n" + context);

        const response = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        console.log(`== ACTIONS == `, response.action);

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
                    // const memories = await sendMessage(
                    //     this.client,
                    //     response,
                    //     memory.roomId,
                    //     this.client.aoConfig.AO_PROFILE_CONTRACT,
                    //     aoMessage.id
                    // );
                    // return memories;
                    return null;
                };

                const responseMessages = await callback(response);

                state = (await this.runtime.updateRecentMessageState(
                    state
                )) as State;

                // for (const responseMessage of responseMessages) {
                //     if (
                //         responseMessage ===
                //         responseMessages[responseMessages.length - 1]
                //     ) {
                //         responseMessage.content.action = response.action;
                //     } else {
                //         responseMessage.content.action = "CONTINUE";
                //     }
                //     await this.runtime.messageManager.createMemory(
                //         responseMessage
                //     );
                // }
                const responseMessage: Memory = {
                    id: stringToUuid(
                        aoMessage.id + "-" + this.client.runtime.agentId
                    ),
                    userId: this.client.runtime.agentId,
                    agentId: this.client.runtime.agentId,
                    createdAt: aoMessage.ingested_at || Date.now(),
                    content: {
                        text: aoMessage.data.value,
                        action: task,
                        source: "AoTheComputer",
                        url: `https://www.ao.link/#/message/${aoMessage.id}`,
                        inReplyTo: stringToUuid(
                            aoMessage.id + "-" + this.client.runtime.agentId
                        ),
                    },
                    embedding: getEmbeddingZeroVector(),
                    roomId: stringToUuid(aoMessage.id),
                };

                await this.runtime.processActions(
                    memory,
                    [responseMessage],
                    state,
                    callback
                );

                const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${aoMessage.id} - ${aoMessage.owner.address}: ${aoMessage.data.value}\nAgent's Output:\n${response.text}`;

                await this.runtime.cacheManager.set(
                    `ao/message_generation_${aoMessage.id}.txt`,
                    responseInfo
                );
                await wait();
            } catch (error) {
                console.log(error);
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
