import { IAgentRuntime } from "@elizaos/core";
import { z, ZodError } from "zod";

export const claraEnvSchema = z.object({
    CLARA_USERNAME: z.string().min(1, "CLARA username is required"),
    CLARA_WALLET: z.string().min(1, "CLARA wallet is required"),
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
                runtime.getSetting("AO_USERNAME") || process.env.AO_USERNAME,

            CLARA_WALLET:
                runtime.getSetting("AO_WALLET") || process.env.AO_WALLET,

            CLARA_WALLET_ID:
                runtime.getSetting("AO_WALLET_ID") || process.env.AO_WALLET_ID,

            CLARA_MARKET_ID:
                runtime.getSetting("AO_MARKET_ID") || process.env.AO_MARKET_ID,

            CLARA_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("AO_POLL_INTERVAL") ||
                    process.env.AO_POLL_INTERVAL,
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
                runtime.getSetting("STORY_USERNAME") ||
                process.env.STORY_USERNAME,

            CLARA_WALLET:
                runtime.getSetting("STORY_WALLET") || process.env.STORY_WALLET,

            CLARA_WALLET_ID:
                runtime.getSetting("STORY_WALLET_ID") ||
                process.env.STORY_WALLET_ID,

            CLARA_MARKET_ID:
                runtime.getSetting("STORY_MARKET_ID") ||
                process.env.STORY_MARKET_ID,

            CLARA_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("AO_POLL_INTERVAL") ||
                    process.env.AO_POLL_INTERVAL,
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
