import { Tweet } from "agent-twitter-client";
import {
    composeContext,
    generateText,
    getEmbeddingZeroVector,
    IAgentRuntime,
    ModelClass,
    stringToUuid,
    UUID,
} from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { postActionResponseFooter } from "@elizaos/core";
import { generateTweetActions } from "@elizaos/core";
import { IImageDescriptionService, ServiceType } from "@elizaos/core";
import { buildConversationThread } from "./utils.ts";
import { aoMessageHandlerTemplate } from "./interactions.ts";
import { NodeType } from "./ao_types.ts";

const aoMessageTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

# Task: Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}}.
Write a post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Do not add commentary or acknowledge this request, just write the post.
Your response should be 1, 2, or 3 sentences (choose the length at random).
Your response should not contain any questions. Brief, concise statements only. The total character count MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.`;

export const aoActionTemplate =
    `
# INSTRUCTIONS: Determine actions for {{agentName}} (@{{twitterUserName}}) based on:
{{bio}}
{{postDirections}}

Guidelines:
- ONLY engage with content that DIRECTLY relates to character's core interests
- Direct mentions are priority IF they are on-topic
- Skip ALL content that is:
  - Off-topic or tangentially related
  - From high-profile accounts unless explicitly relevant
  - Generic/viral content without specific relevance
  - Political/controversial unless central to character
  - Promotional/marketing unless directly relevant

Actions (respond only with tags):
[LIKE] - Perfect topic match AND aligns with character (9.8/10)
[RETWEET] - Exceptional content that embodies character's expertise (9.5/10)
[QUOTE] - Can add substantial domain expertise (9.5/10)
[REPLY] - Can contribute meaningful, expert-level insight (9.5/10)

Tweet:
{{currentTweet}}

# Respond with qualifying action tags only. Default to NO action unless extremely confident of relevance.` +
    postActionResponseFooter;

/**
 * Truncate text to fit within the AoTheComputer character limit, ensuring it ends at a complete sentence.
 */
function truncateToCompleteSentence(
    text: string,
    maxTweetLength: number
): string {
    if (text.length <= maxTweetLength) {
        return text;
    }

    // Attempt to truncate at the last period within the limit
    const lastPeriodIndex = text.lastIndexOf(".", maxTweetLength - 1);
    if (lastPeriodIndex !== -1) {
        const truncatedAtPeriod = text.slice(0, lastPeriodIndex + 1).trim();
        if (truncatedAtPeriod.length > 0) {
            return truncatedAtPeriod;
        }
    }

    // If no period, truncate to the nearest whitespace within the limit
    const lastSpaceIndex = text.lastIndexOf(" ", maxTweetLength - 1);
    if (lastSpaceIndex !== -1) {
        const truncatedAtSpace = text.slice(0, lastSpaceIndex).trim();
        if (truncatedAtSpace.length > 0) {
            return truncatedAtSpace + "...";
        }
    }

    // Fallback: Hard truncate and add ellipsis
    const hardTruncated = text.slice(0, maxTweetLength - 3).trim();
    return hardTruncated + "...";
}

export class AoTheComputerPostClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    aoUsername: string;
    private isProcessing: boolean = false;
    private lastProcessTime: number = 0;
    private stopProcessingActions: boolean = false;
    private isDryRun: boolean;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
        this.aoUsername = this.client.aoConfig.AO_USERNAME;
        this.isDryRun = this.client.aoConfig.AO_DRY_RUN;

        // Log configuration on initialization
        elizaLogger.log("AoTheComputer Client Configuration:");
        elizaLogger.log(`- Username: ${this.aoUsername}`);
        elizaLogger.log(
            `- Dry Run Mode: ${this.isDryRun ? "enabled" : "disabled"}`
        );
        elizaLogger.log(
            `- Post Interval: ${this.client.aoConfig.AO_MESSAGE_INTERVAL_MIN}-${this.client.aoConfig.AO_MESSAGE_INTERVAL_MAX} minutes`
        );
        elizaLogger.log(
            `- Action Processing: ${this.client.aoConfig.AO_ENABLE_ACTION_PROCESSING ? "enabled" : "disabled"}`
        );
        elizaLogger.log(
            `- Action Interval: ${this.client.aoConfig.AO_ACTION_INTERVAL} minutes`
        );
        elizaLogger.log(
            `- Post Immediately: ${this.client.aoConfig.AO_MESSAGE_IMMEDIATELY ? "enabled" : "disabled"}`
        );

        if (this.isDryRun) {
            elizaLogger.log(
                "AoTheComputer client initialized in dry run mode - no actual tweets should be posted"
            );
        }
    }

    async start() {
        if (!this.client.profile) {
            await this.client.init();
        }

        const generateNewMessageLoop = async () => {
            const lastPost = await this.runtime.cacheManager.get<{
                timestamp: number;
            }>("ao/" + this.aoUsername + "/lastPost");

            const lastPostTimestamp = lastPost?.timestamp ?? 0;
            const minMinutes = this.client.aoConfig.AO_MESSAGE_INTERVAL_MIN;
            const maxMinutes = this.client.aoConfig.AO_MESSAGE_INTERVAL_MAX;
            const randomMinutes =
                Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) +
                minMinutes;
            const delay = randomMinutes * 60 * 1000;

            if (Date.now() > lastPostTimestamp + delay) {
                await this.generateNewMessage();
            }

            setTimeout(() => {
                generateNewMessageLoop(); // Set up next iteration
            }, delay);

            elizaLogger.log(`Next tweet scheduled in ${randomMinutes} minutes`);
        };

        const processActionsLoop = async () => {
            const actionInterval = this.client.aoConfig.AO_ACTION_INTERVAL; // Defaults to 5 minutes

            while (!this.stopProcessingActions) {
                try {
                    const results = await this.processTweetActions();
                    if (results) {
                        elizaLogger.log(`Processed ${results.length} tweets`);
                        elizaLogger.log(
                            `Next action processing scheduled in ${actionInterval} minutes`
                        );
                        // Wait for the full interval before next processing
                        await new Promise(
                            (resolve) =>
                                setTimeout(resolve, actionInterval * 60 * 1000) // now in minutes
                        );
                    }
                } catch (error) {
                    elizaLogger.error(
                        "Error in action processing loop:",
                        error
                    );
                    // Add exponential backoff on error
                    await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30s on error
                }
            }
        };

        if (this.client.aoConfig.AO_MESSAGE_IMMEDIATELY) {
            await this.generateNewMessage();
        }

        // Only start tweet generation loop if not in dry run mode
        if (!this.isDryRun) {
            generateNewMessageLoop();
            elizaLogger.log("Tweet generation loop started");
        } else {
            elizaLogger.log("Tweet generation loop disabled (dry run mode)");
        }

        if (
            this.client.aoConfig.AO_ENABLE_ACTION_PROCESSING &&
            !this.isDryRun
        ) {
            processActionsLoop().catch((error) => {
                elizaLogger.error(
                    "Fatal error in process actions loop:",
                    error
                );
            });
        } else {
            if (this.isDryRun) {
                elizaLogger.log(
                    "Action processing loop disabled (dry run mode)"
                );
            } else {
                elizaLogger.log(
                    "Action processing loop disabled by configuration"
                );
            }
        }
    }

    createTweetObject(
        tweetResult: any,
        client: any,
        twitterUsername: string
    ): Tweet {
        return {
            id: tweetResult.rest_id,
            name: client.profile.screenName,
            username: client.profile.username,
            text: tweetResult.legacy.full_text,
            conversationId: tweetResult.legacy.conversation_id_str,
            createdAt: tweetResult.legacy.created_at,
            timestamp: new Date(tweetResult.legacy.created_at).getTime(),
            userId: client.profile.id,
            inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
            permanentUrl: `https://ao.link/${twitterUsername}/status/${tweetResult.rest_id}`,
            hashtags: [],
            mentions: [],
            photos: [],
            thread: [],
            urls: [],
            videos: [],
        } as Tweet;
    }

    async processAndCacheTweet(
        runtime: IAgentRuntime,
        client: ClientBase,
        aoMessage: NodeType,
        roomId: UUID,
        newTweetContent: string
    ) {
        // Cache the last post details
        await runtime.cacheManager.set(
            `ao/${client.profile.Profile.UserName}/lastPost`,
            {
                id: aoMessage.id,
                timestamp: Date.now(),
            }
        );

        // Cache the tweet
        await client.cacheMessage(aoMessage);
        2;
        // Log the posted tweet
        elizaLogger.log(
            `Message sent:\n https://www.ao.link/#/message/${aoMessage.id}`
        );

        // Ensure the room and participant exist
        await runtime.ensureRoomExists(roomId);
        await runtime.ensureParticipantInRoom(runtime.agentId, roomId);

        // Create a memory for the tweet
        await runtime.messageManager.createMemory({
            id: stringToUuid(aoMessage.id + "-" + runtime.agentId),
            userId: runtime.agentId,
            agentId: runtime.agentId,
            content: {
                text: newTweetContent.trim(),
                url: `https://www.ao.link/#/message/${aoMessage.id}`,
                source: "AoTheComputer",
            },
            roomId,
            embedding: getEmbeddingZeroVector(),
            createdAt: aoMessage.timestamp,
        });
    }

    async handleNoteTweet(
        client: ClientBase,
        runtime: IAgentRuntime,
        content: string,
        tweetId?: string
    ) {
        try {
            const noteMessageResult = await client.requestQueue.add(
                async () =>
                    await client.aoClient.sendNoteTweet(content, tweetId)
            );

            if (
                noteMessageResult.errors &&
                noteMessageResult.errors.length > 0
            ) {
                // Note Tweet failed due to authorization. Falling back to standard Tweet.
                const truncateContent = truncateToCompleteSentence(
                    content,
                    this.client.aoConfig.AO_MAX_MESSAGE_LENGTH
                );
                return await this.sendStandardAoMessage(
                    client,
                    truncateContent,
                    tweetId
                );
            } else {
                return noteMessageResult.data.notetweet_create.tweet_results
                    .result;
            }
        } catch (error) {
            throw new Error(`Note Tweet failed: ${error}`);
        }
    }

    async sendStandardAoMessage(
        client: ClientBase,
        content: string,
        tweetId?: string
    ) {
        try {
            const aoMessageResult = await client.requestQueue.add(
                async () =>
                    await client.aoClient.sendAoMessage(content, tweetId)
            );
            // const body = await sendStandardAoMessageResult.json();
            if (!aoMessageResult) {
                console.error(
                    "Error sending AO message; Bad response:",
                    aoMessageResult
                );
                return;
            }
            return aoMessageResult;
        } catch (error) {
            console.log(error)
            elizaLogger.error("Error sending standard Message:", error);
            throw error;
        }
    }

    async postMessage(
        runtime: IAgentRuntime,
        client: ClientBase,
        cleanedContent: string,
        roomId: UUID,
        newMessageContent: string,
        aoUsername: string
    ) {
        try {
            elizaLogger.log(`Sending new message to process:\n`, cleanedContent);

            let result;

            // if (cleanedContent.length > AO_DEFAULT_MAX_MESSAGE_LENGTH) {
            //     result = await this.handleNoteTweet(
            //         client,
            //         runtime,
            //         cleanedContent
            //     );
            // } else {
            result = await this.sendStandardAoMessage(client, cleanedContent);
            // }

            // const tweet = this.createTweetObject(result, client, aoUsername);
            // TODO: Here we should probably
            const aoMessage = {} as NodeType;
            await this.processAndCacheTweet(
                runtime,
                client,
                aoMessage,
                roomId,
                newMessageContent
            );
        } catch (error) {
            console.error(`send standard ao message`, error);
            elizaLogger.error("Error sending message:", error);
        }
    }

    /**
     * Generates and posts a new tweet. If isDryRun is true, only logs what would have been posted.
     */
    private async generateNewMessage() {
        elizaLogger.log("Generating new AO message");

        try {
            const roomId = stringToUuid(
                "ao_generate_room-" + this.client.profile.Profile.UserName
            );
            await this.runtime.ensureUserExists(
                this.runtime.agentId,
                this.client.profile.Profile.UserName,
                this.runtime.character.name,
                "ao"
            );

            const topics = this.runtime.character.topics.join(", ");

            const state = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: roomId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: topics || "",
                        action: "SEND_MESSAGE",
                    },
                },
                {
                    aoUserName: this.client.profile.Profile.UserName,
                }
            );

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.aoMessageTemplate ||
                    aoMessageTemplate,
            });

            elizaLogger.debug("generate message prompt:\n" + context);

            const newMessageContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            // First attempt to clean content
            let cleanedContent = "";

            // Try parsing as JSON first
            try {
                const parsedResponse = JSON.parse(newMessageContent);
                if (parsedResponse.text) {
                    cleanedContent = parsedResponse.text;
                } else if (typeof parsedResponse === "string") {
                    cleanedContent = parsedResponse;
                }
            } catch (error) {
                error.linted = true; // make linter happy since catch needs a variable
                // If not JSON, clean the raw content
                cleanedContent = newMessageContent
                    .replace(/^\s*{?\s*"text":\s*"|"\s*}?\s*$/g, "") // Remove JSON-like wrapper
                    .replace(/^['"](.*)['"]$/g, "$1") // Remove quotes
                    .replace(/\\"/g, '"') // Unescape quotes
                    .replace(/\\n/g, "\n\n") // Unescape newlines, ensures double spaces
                    .trim();
            }

            if (!cleanedContent) {
                elizaLogger.error(
                    "Failed to extract valid content from response:",
                    {
                        rawResponse: newMessageContent,
                        attempted: "JSON parsing",
                    }
                );
                return;
            }

            // Truncate the content to the maximum tweet length specified in the environment settings, ensuring the truncation respects sentence boundaries.
            const maxMessageLength = this.client.aoConfig.AO_MAX_MESSAGE_LENGTH;
            if (maxMessageLength) {
                cleanedContent = truncateToCompleteSentence(
                    cleanedContent,
                    maxMessageLength
                );
            }

            const removeQuotes = (str: string) =>
                str.replace(/^['"](.*)['"]$/, "$1");

            const fixNewLines = (str: string) => str.replaceAll(/\\n/g, "\n\n"); //ensures double spaces

            // Final cleaning
            cleanedContent = removeQuotes(fixNewLines(cleanedContent));

            if (this.isDryRun) {
                elizaLogger.info(
                    `Dry run: would have posted message: ${cleanedContent}`
                );
                return;
            }

            try {
                elizaLogger.log(`Posting new message:\n ${cleanedContent}`);
                this.postMessage(
                    this.runtime,
                    this.client,
                    cleanedContent,
                    roomId,
                    newMessageContent,
                    this.aoUsername
                );
            } catch (error) {
                console.error(`postMessage`, error)
                elizaLogger.error("Error sending message:", error);
            }
        } catch (error) {
            console.error(error)
            elizaLogger.error("Error generating new message:", error);
        }
    }

    private async generateTweetContent(
        tweetState: any,
        options?: {
            template?: string;
            context?: string;
        }
    ): Promise<string> {
        const context = composeContext({
            state: tweetState,
            template:
                options?.template ||
                this.runtime.character.templates?.twitterPostTemplate ||
                aoMessageTemplate,
        });

        const response = await generateText({
            runtime: this.runtime,
            context: options?.context || context,
            modelClass: ModelClass.SMALL,
        });
        elizaLogger.debug("generate tweet content response:\n" + response);

        // First clean up any markdown and newlines
        const cleanedResponse = response
            .replace(/```json\s*/g, "") // Remove ```json
            .replace(/```\s*/g, "") // Remove any remaining ```
            .replaceAll(/\\n/g, "\n")
            .trim();

        // Try to parse as JSON first
        try {
            const jsonResponse = JSON.parse(cleanedResponse);
            if (jsonResponse.text) {
                return this.trimTweetLength(jsonResponse.text);
            }
            if (typeof jsonResponse === "object") {
                const possibleContent =
                    jsonResponse.content ||
                    jsonResponse.message ||
                    jsonResponse.response;
                if (possibleContent) {
                    return this.trimTweetLength(possibleContent);
                }
            }
        } catch (error) {
            error.linted = true; // make linter happy since catch needs a variable

            // If JSON parsing fails, treat as plain text
            elizaLogger.debug("Response is not JSON, treating as plain text");
        }

        // If not JSON or no valid content found, clean the raw text
        return this.trimTweetLength(cleanedResponse);
    }

    // Helper method to ensure tweet length compliance
    private trimTweetLength(text: string, maxLength: number = 280): string {
        if (text.length <= maxLength) return text;

        // Try to cut at last sentence
        const lastSentence = text.slice(0, maxLength).lastIndexOf(".");
        if (lastSentence > 0) {
            return text.slice(0, lastSentence + 1).trim();
        }

        // Fallback to word boundary
        return (
            text.slice(0, text.lastIndexOf(" ", maxLength - 3)).trim() + "..."
        );
    }

    /**
     * Processes tweet actions (likes, retweets, quotes, replies). If isDryRun is true,
     * only simulates and logs actions without making API calls.
     */
    private async processTweetActions() {
        if (this.isProcessing) {
            elizaLogger.log("Already processing tweet actions, skipping");
            return null;
        }

        try {
            this.isProcessing = true;
            this.lastProcessTime = Date.now();

            elizaLogger.log("Processing tweet actions");

            if (this.isDryRun) {
                elizaLogger.log("Dry run mode: simulating tweet actions");
                return [];
            }

            await this.runtime.ensureUserExists(
                this.runtime.agentId,
                this.aoUsername,
                this.runtime.character.name,
                "twitter"
            );

            const homeTimeline = await this.client.fetchTimelineForActions(15);
            const results = [];

            for (const tweet of homeTimeline) {
                try {
                    // Skip if we've already processed this tweet
                    const memory =
                        await this.runtime.messageManager.getMemoryById(
                            stringToUuid(tweet.id + "-" + this.runtime.agentId)
                        );
                    if (memory) {
                        elizaLogger.log(
                            `Already processed tweet ID: ${tweet.id}`
                        );
                        continue;
                    }

                    const roomId = stringToUuid(
                        tweet.conversationId + "-" + this.runtime.agentId
                    );

                    const tweetState = await this.runtime.composeState(
                        {
                            userId: this.runtime.agentId,
                            roomId,
                            agentId: this.runtime.agentId,
                            content: { text: "", action: "" },
                        },
                        {
                            twitterUserName: this.aoUsername,
                            currentTweet: `ID: ${tweet.id}\nFrom: ${tweet.name} (@${tweet.username})\nText: ${tweet.text}`,
                        }
                    );

                    const actionContext = composeContext({
                        state: tweetState,
                        template:
                            this.runtime.character.templates
                                ?.aoActionTemplate || aoActionTemplate,
                    });

                    const actionResponse = await generateTweetActions({
                        runtime: this.runtime,
                        context: actionContext,
                        modelClass: ModelClass.SMALL,
                    });

                    if (!actionResponse) {
                        elizaLogger.log(
                            `No valid actions generated for tweet ${tweet.id}`
                        );
                        continue;
                    }

                    const executedActions: string[] = [];

                    // Execute actions
                    if (actionResponse.like) {
                        try {
                            if (this.isDryRun) {
                                elizaLogger.info(
                                    `Dry run: would have liked tweet ${tweet.id}`
                                );
                                executedActions.push("like (dry run)");
                            } else {
                                await this.client.aoClient.likeTweet(tweet.id);
                                executedActions.push("like");
                                elizaLogger.log(`Liked tweet ${tweet.id}`);
                            }
                        } catch (error) {
                            elizaLogger.error(
                                `Error liking tweet ${tweet.id}:`,
                                error
                            );
                        }
                    }

                    if (actionResponse.retweet) {
                        try {
                            if (this.isDryRun) {
                                elizaLogger.info(
                                    `Dry run: would have retweeted tweet ${tweet.id}`
                                );
                                executedActions.push("retweet (dry run)");
                            } else {
                                await this.client.aoClient.retweet(tweet.id);
                                executedActions.push("retweet");
                                elizaLogger.log(`Retweeted tweet ${tweet.id}`);
                            }
                        } catch (error) {
                            elizaLogger.error(
                                `Error retweeting tweet ${tweet.id}:`,
                                error
                            );
                        }
                    }

                    if (actionResponse.quote) {
                        try {
                            // Check for dry run mode
                            if (this.isDryRun) {
                                elizaLogger.info(
                                    `Dry run: would have posted quote tweet for ${tweet.id}`
                                );
                                executedActions.push("quote (dry run)");
                                continue;
                            }

                            // Build conversation thread for context
                            const thread = await buildConversationThread(
                                tweet,
                                this.client
                            );
                            const formattedConversation = thread
                                .map(
                                    (t) =>
                                        `@${t.username} (${new Date(t.timestamp * 1000).toLocaleString()}): ${t.text}`
                                )
                                .join("\n\n");

                            // Generate image descriptions if present
                            const imageDescriptions = [];
                            if (tweet.photos?.length > 0) {
                                elizaLogger.log(
                                    "Processing images in tweet for context"
                                );
                                for (const photo of tweet.photos) {
                                    const description = await this.runtime
                                        .getService<IImageDescriptionService>(
                                            ServiceType.IMAGE_DESCRIPTION
                                        )
                                        .describeImage(photo.url);
                                    imageDescriptions.push(description);
                                }
                            }

                            // Handle quoted tweet if present
                            let quotedContent = "";
                            if (tweet.quotedStatusId) {
                                try {
                                    const quotedTweet =
                                        await this.client.aoClient.getMessage(
                                            tweet.quotedStatusId
                                        );
                                    if (quotedTweet) {
                                        quotedContent = `\nQuoted Tweet from @${quotedTweet.username}:\n${quotedTweet.text}`;
                                    }
                                } catch (error) {
                                    elizaLogger.error(
                                        "Error fetching quoted tweet:",
                                        error
                                    );
                                }
                            }

                            // Compose rich state with all context
                            const enrichedState =
                                await this.runtime.composeState(
                                    {
                                        userId: this.runtime.agentId,
                                        roomId: stringToUuid(
                                            tweet.conversationId +
                                                "-" +
                                                this.runtime.agentId
                                        ),
                                        agentId: this.runtime.agentId,
                                        content: {
                                            text: tweet.text,
                                            action: "QUOTE",
                                        },
                                    },
                                    {
                                        twitterUserName: this.aoUsername,
                                        currentPost: `From @${tweet.username}: ${tweet.text}`,
                                        formattedConversation,
                                        imageContext:
                                            imageDescriptions.length > 0
                                                ? `\nImages in Tweet:\n${imageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}`
                                                : "",
                                        quotedContent,
                                    }
                                );

                            const quoteContent =
                                await this.generateTweetContent(enrichedState, {
                                    template:
                                        this.runtime.character.templates
                                            ?.twitterMessageHandlerTemplate ||
                                        aoMessageHandlerTemplate,
                                });

                            if (!quoteContent) {
                                elizaLogger.error(
                                    "Failed to generate valid quote tweet content"
                                );
                                return;
                            }

                            elizaLogger.log(
                                "Generated quote tweet content:",
                                quoteContent
                            );

                            // Send the tweet through request queue
                            const result = await this.client.requestQueue.add(
                                async () =>
                                    await this.client.aoClient.sendQuoteTweet(
                                        quoteContent,
                                        tweet.id
                                    )
                            );

                            const body = await result.json();

                            if (
                                body?.data?.create_tweet?.tweet_results?.result
                            ) {
                                elizaLogger.log(
                                    "Successfully posted quote tweet"
                                );
                                executedActions.push("quote");

                                // Cache generation context for debugging
                                await this.runtime.cacheManager.set(
                                    `twitter/quote_generation_${tweet.id}.txt`,
                                    `Context:\n${enrichedState}\n\nGenerated Quote:\n${quoteContent}`
                                );
                            } else {
                                elizaLogger.error(
                                    "Quote tweet creation failed:",
                                    body
                                );
                            }
                        } catch (error) {
                            elizaLogger.error(
                                "Error in quote tweet generation:",
                                error
                            );
                        }
                    }

                    if (actionResponse.reply) {
                        try {
                            await this.handleTextOnlyReply(
                                tweet,
                                tweetState,
                                executedActions
                            );
                        } catch (error) {
                            elizaLogger.error(
                                `Error replying to tweet ${tweet.id}:`,
                                error
                            );
                        }
                    }

                    // Add these checks before creating memory
                    await this.runtime.ensureRoomExists(roomId);
                    await this.runtime.ensureUserExists(
                        stringToUuid(tweet.userId),
                        tweet.username,
                        tweet.name,
                        "twitter"
                    );
                    await this.runtime.ensureParticipantInRoom(
                        this.runtime.agentId,
                        roomId
                    );

                    // Then create the memory
                    await this.runtime.messageManager.createMemory({
                        id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                        userId: stringToUuid(tweet.userId),
                        content: {
                            text: tweet.data.value,
                            url: tweet.url,
                            source: "AoTheComputer",
                            action: executedActions.join(","),
                        },
                        agentId: this.runtime.agentId,
                        roomId,
                        embedding: getEmbeddingZeroVector(),
                        createdAt: tweet.timestamp * 1000,
                    });

                    results.push({
                        tweetId: tweet.id,
                        parsedActions: actionResponse,
                        executedActions,
                    });
                } catch (error) {
                    elizaLogger.error(
                        `Error processing tweet ${tweet.id}:`,
                        error
                    );
                    continue;
                }
            }

            return results; // Return results array to indicate completion
        } catch (error) {
            elizaLogger.error("Error in processTweetActions:", error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Handles text-only replies to tweets. If isDryRun is true, only logs what would
     * have been replied without making API calls.
     */
    private async handleTextOnlyReply(
        tweet: Tweet,
        tweetState: any,
        executedActions: string[]
    ) {
        try {
            // Build conversation thread for context
            const thread = await buildConversationThread(tweet, this.client);
            const formattedConversation = thread
                .map(
                    (t) =>
                        `@${t.username} (${new Date(t.timestamp * 1000).toLocaleString()}): ${t.text}`
                )
                .join("\n\n");

            // Generate image descriptions if present
            const imageDescriptions = [];
            if (tweet.photos?.length > 0) {
                elizaLogger.log("Processing images in tweet for context");
                for (const photo of tweet.photos) {
                    const description = await this.runtime
                        .getService<IImageDescriptionService>(
                            ServiceType.IMAGE_DESCRIPTION
                        )
                        .describeImage(photo.url);
                    imageDescriptions.push(description);
                }
            }

            // Handle quoted tweet if present
            let quotedContent = "";
            if (tweet.quotedStatusId) {
                try {
                    const quotedTweet = await this.client.aoClient.getMessage(
                        tweet.quotedStatusId
                    );
                    if (quotedTweet) {
                        quotedContent = `\nQuoted Tweet from @${quotedTweet.username}:\n${quotedTweet.text}`;
                    }
                } catch (error) {
                    elizaLogger.error("Error fetching quoted tweet:", error);
                }
            }

            // Compose rich state with all context
            const enrichedState = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: stringToUuid(
                        tweet.conversationId + "-" + this.runtime.agentId
                    ),
                    agentId: this.runtime.agentId,
                    content: { text: tweet.text, action: "" },
                },
                {
                    twitterUserName: this.aoUsername,
                    currentPost: `From @${tweet.username}: ${tweet.text}`,
                    formattedConversation,
                    imageContext:
                        imageDescriptions.length > 0
                            ? `\nImages in Tweet:\n${imageDescriptions.map((desc, i) => `Image ${i + 1}: ${desc}`).join("\n")}`
                            : "",
                    quotedContent,
                }
            );

            // Generate and clean the reply content
            const replyText = await this.generateTweetContent(enrichedState, {
                template:
                    this.runtime.character.templates
                        ?.twitterMessageHandlerTemplate ||
                    aoMessageHandlerTemplate,
            });

            if (!replyText) {
                elizaLogger.error("Failed to generate valid reply content");
                return;
            }

            if (this.isDryRun) {
                elizaLogger.info(
                    `Dry run: reply to tweet ${tweet.id} would have been: ${replyText}`
                );
                executedActions.push("reply (dry run)");
                return;
            }

            elizaLogger.debug("Final reply text to be sent:", replyText);

            let result;

            if (replyText.length > DEFAULT_MAX_TWEET_LENGTH) {
                result = await this.handleNoteTweet(
                    this.client,
                    this.runtime,
                    replyText,
                    tweet.id
                );
            } else {
                result = await this.sendStandardTweet(
                    this.client,
                    replyText,
                    tweet.id
                );
            }

            if (result) {
                elizaLogger.log("Successfully posted reply tweet");
                executedActions.push("reply");

                // Cache generation context for debugging
                await this.runtime.cacheManager.set(
                    `twitter/reply_generation_${tweet.id}.txt`,
                    `Context:\n${enrichedState}\n\nGenerated Reply:\n${replyText}`
                );
            } else {
                elizaLogger.error("Tweet reply creation failed");
            }
        } catch (error) {
            elizaLogger.error("Error in handleTextOnlyReply:", error);
        }
    }

    async stop() {
        this.stopProcessingActions = true;
    }
}
