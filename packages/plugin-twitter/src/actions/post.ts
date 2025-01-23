import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    composeContext,
    elizaLogger,
    ModelClass,
    generateObject,
    messageCompletionFooter,
    HandlerCallback,
} from "@elizaos/core";
import { Scraper } from "agent-twitter-client";
import { tweetTemplate } from "../templates";
import { isTweetContent, TweetMetadata, TweetSchema } from "../types";

async function composeTweet(
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State
): Promise<string> {
    try {
        const context = composeContext({
            state,
            template: tweetTemplate + `\n${messageCompletionFooter}`,
        });

        const tweetContentObject = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: TweetSchema,
            stop: ["\n"],
        });
        console.log(`tweet content`, tweetContentObject);

        if (!isTweetContent(tweetContentObject)) {
            elizaLogger.error(
                "Invalid tweet content:",
                tweetContentObject.object
            );
            return;
        }

        const trimmedContent = tweetContentObject.text.trim();

        // Skip truncation if TWITTER_PREMIUM is true
        if (
            process.env.TWITTER_PREMIUM?.toLowerCase() !== "true" &&
            trimmedContent.length > 180
        ) {
            elizaLogger.warn(
                `Tweet too long (${trimmedContent.length} chars), truncating...`
            );
            return trimmedContent.substring(0, 177) + "...";
        }

        return trimmedContent;
    } catch (error) {
        elizaLogger.error("Error composing tweet:", error);
        throw error;
    }
}

async function postTweet(content: string): Promise<TweetMetadata | null> {
    try {
        const scraper = new Scraper();
        const username = process.env.TWITTER_USERNAME;
        const password = process.env.TWITTER_PASSWORD;
        const email = process.env.TWITTER_EMAIL;
        const twitter2faSecret = process.env.TWITTER_2FA_SECRET;

        if (!username || !password) {
            elizaLogger.error(
                "Twitter credentials not configured in environment"
            );
            return null;
        }

        // Login with credentials
        await scraper.login(username, password, email, twitter2faSecret);
        if (!(await scraper.isLoggedIn())) {
            elizaLogger.error("Failed to login to Twitter");
            return null;
        }

        // Send the tweet
        elizaLogger.log("Attempting to send tweet:", content);
        const result = await scraper.sendTweet(content);

        const body = await result.json();
        elizaLogger.log("Tweet response:", body);

        // Check for Twitter API errors
        if (body.errors) {
            const error = body.errors[0];
            elizaLogger.error(
                `Twitter API error (${error.code}): ${error.message}`
            );
            return null;
        }

        // Check for successful tweet creation
        if (!body?.data?.create_tweet?.tweet_results?.result) {
            elizaLogger.error(
                "Failed to post tweet: No tweet result in response"
            );
            return null;
        }

        return {
            userName:
                body?.data?.create_tweet?.tweet_results?.result?.core
                    ?.user_results?.result?.legacy?.screen_name,
            id: body?.data?.create_tweet?.tweet_results?.result?.rest_id,
        };
    } catch (error) {
        // Log the full error details
        elizaLogger.error("Error posting tweet:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause,
        });
        return null;
    }
}

export const postAction: Action = {
    name: "POST_TWEET",
    similes: ["TWEET", "POST", "SEND_TWEET"],
    description: "Post a tweet to Twitter",
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ) => {
        const hasCredentials =
            !!process.env.TWITTER_USERNAME && !!process.env.TWITTER_PASSWORD;
        elizaLogger.log(`Has credentials: ${hasCredentials}`);

        return hasCredentials;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            // Generate tweet content using context
            console.log("generating tweet");
            const tweetContent = await composeTweet(runtime, message, state);
            console.log("tweet content", tweetContent);

            if (!tweetContent) {
                elizaLogger.error("No content generated for tweet");
                callback({
                    text: `No content generated for tweet`,
                });
                return false;
            }

            elizaLogger.log(`Generated tweet content: ${tweetContent}`);

            // Check for dry run mode - explicitly check for string "true"
            if (
                process.env.TWITTER_DRY_RUN &&
                process.env.TWITTER_DRY_RUN.toLowerCase() === "true"
            ) {
                elizaLogger.info(
                    `Dry run: would have posted tweet: ${tweetContent}`
                );
                callback({
                    text: `No content generated for tweet.`,
                });
                return true;
            }

            const result = await postTweet(tweetContent);
            if (result) {
                callback({
                    text: tweetContent,
                    id: result.id,
                    userName: result.userName,
                });
            } else {
                callback({
                    text: `Could not post tweet.`,
                });
            }
            return !!result;
        } catch (error) {
            elizaLogger.error("Error in post action:", error);
            callback({
                text: `Could not post tweet.`,
            });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "You should tweet that" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll share this update with my followers right away!",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Post this tweet" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post that as a tweet now.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Share that on Twitter" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll share this message on Twitter.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Post that on X" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post this message on X right away.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "You should put that on X dot com" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll put this message up on X.com now.",
                    action: "POST_TWEET",
                },
            },
        ],
    ],
};
