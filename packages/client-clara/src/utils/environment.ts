import { IAgentRuntime } from "@elizaos/core";
import { privateKeyToAccount } from "viem/accounts";
import { z, ZodError } from "zod";

export const claraEnvSchema = z.object({
    CLARA_USERNAME: z.string().min(1, "CLARA username is required"),
    CLARA_PRIVATE_KEY: z.string().min(1, "CLARA wallet is required"),
    CLARA_WALLET_ID: z.string().min(1, "CLARA wallet id is required"),
    CLARA_MARKET_ID: z.string().min(1, "CLARA market protocol id is required"),
    CLARA_POLL_INTERVAL: z.number().int(),
});

export type ClaraSchema = z.infer<typeof claraEnvSchema>;
export type ClaraConfig = ClaraSchema & { CLARA_IMPL: string };

export async function validateAoConfig(
    runtime: IAgentRuntime
): Promise<ClaraConfig> {
    try {
        const aoConfig = {
            CLARA_USERNAME:
                runtime.getSetting("CLARA_AO_USERNAME") ||
                process.env.CLARA_AO_USERNAME,

            CLARA_PRIVATE_KEY:
                runtime.getSetting("CLARA_AO_WALLET") ||
                process.env.CLARA_AO_WALLET,

            CLARA_WALLET_ID:
                runtime.getSetting("CLARA_AO_WALLET_ID") ||
                process.env.CLARA_AO_WALLET_ID,

            CLARA_MARKET_ID:
                runtime.getSetting("CLARA_AO_MARKET_ID") ||
                process.env.CLARA_AO_MARKET_ID,

            CLARA_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("CLARA_AO_POLL_INTERVAL") ||
                    process.env.CLARA_AO_POLL_INTERVAL,
                120 // 2m
            ),
        };

        return {
            ...claraEnvSchema.parse(aoConfig),
            CLARA_IMPL: "ao",
        };
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `X/AO configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}

export async function validateStoryConfig(
    runtime: IAgentRuntime
): Promise<ClaraConfig> {
    try {
        const storyConfig = {
            CLARA_USERNAME:
                runtime.getSetting("CLARA_STORY_USERNAME") ||
                process.env.CLARA_STORY_USERNAME,

            CLARA_PRIVATE_KEY:
                runtime.getSetting("CLARA_STORY_PRIVATE_KEY") ||
                process.env.CLARA_STORY_PRIVATE_KEY,

            CLARA_WALLET_ID: privateKeyToAccount(
                (runtime.getSetting("CLARA_STORY_PRIVATE_KEY") ||
                    process.env.CLARA_STORY_PRIVATE_KEY) as `0x${string}`
            ).address,

            CLARA_MARKET_ID:
                runtime.getSetting("CLARA_STORY_MARKET_ID") ||
                process.env.CLARA_STORY_MARKET_ID,

            CLARA_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("CLARA_AO_POLL_INTERVAL") ||
                    process.env.CLARA_AO_POLL_INTERVAL,
                120 // 2m
            ),
        };

        return {
            ...claraEnvSchema.parse(storyConfig),
            CLARA_IMPL: "story",
        };
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `X/AO configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}

function safeParseInt(
    value: string | undefined | null,
    defaultValue: number
): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : Math.max(1, parsed);
}
