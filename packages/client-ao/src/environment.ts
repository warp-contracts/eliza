import { parseBooleanFromText, IAgentRuntime } from "@elizaos/core";
import { z, ZodError } from "zod";

export const DEFAULT_MAX_TWEET_LENGTH = 280;

const aoTheComputerUsernameSchema = z
    .string()
    .min(1, "An X/AoTheComputer Username must be at least 1 characters long")
    .max(15, "An X/AoTheComputer Username cannot exceed 15 characters")
    .regex(
        /^[A-Za-z0-9_]*$/,
        "An X Username can only contain letters, numbers, and underscores"
    );

/**
 * This schema defines all required/optional environment settings
 */
export const aoTheComputerEnvSchema = z.object({
    TWITTER_DRY_RUN: z.boolean(),
    AO_USERNAME: z.string().min(1, "AoTheComputer username is required"),
    AO_PROFILE_CONTRACT: z.string().min(1, "AoTheComputer profile contract is required"),
    AO_ROUTING_CONTRACT: z.string().min(1, "Valid Ao routing contract is required"),
    MAX_TWEET_LENGTH: z.number().int().default(DEFAULT_MAX_TWEET_LENGTH),
    AO_SEARCH_ENABLE: z.boolean().default(false),
    TWITTER_RETRY_LIMIT: z.number().int(),
    TWITTER_POLL_INTERVAL: z.number().int(),
    // I guess it's possible to do the transformation with zod
    // not sure it's preferable, maybe a readability issue
    // since more people will know js/ts than zod
    /*
        z
        .string()
        .transform((val) => val.trim())
        .pipe(
            z.string()
                .transform((val) =>
                    val ? val.split(',').map((u) => u.trim()).filter(Boolean) : []
                )
                .pipe(
                    z.array(
                        z.string()
                            .min(1)
                            .max(15)
                            .regex(
                                /^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$|^[A-Za-z]$/,
                                'Invalid AoTheComputer username format'
                            )
                    )
                )
                .transform((users) => users.join(','))
        )
        .optional()
        .default(''),
    */
    POST_INTERVAL_MIN: z.number().int(),
    POST_INTERVAL_MAX: z.number().int(),
    ENABLE_ACTION_PROCESSING: z.boolean(),
    ACTION_INTERVAL: z.number().int(),
    POST_IMMEDIATELY: z.boolean(),
});

export type AoTheComputerConfig = z.infer<typeof aoTheComputerEnvSchema>;

/**
 * Helper to parse a comma-separated list of AoTheComputer usernames
 * (already present in your code).
 */
function parseTargetUsers(targetUsersStr?: string | null): string[] {
    if (!targetUsersStr?.trim()) {
        return [];
    }
    return targetUsersStr
        .split(",")
        .map((user) => user.trim())
        .filter(Boolean);
}

function safeParseInt(
    value: string | undefined | null,
    defaultValue: number
): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : Math.max(1, parsed);
}

/**
 * Validates or constructs a AoTheComputerConfig object using zod,
 * taking values from the IAgentRuntime or process.env as needed.
 */
// This also is organized to serve as a point of documentation for the client
// most of the inputs from the framework (env/character)

// we also do a lot of typing/parsing here
// so we can do it once and only once per character
export async function validateAoTheComputerConfig(
    runtime: IAgentRuntime
): Promise<AoTheComputerConfig> {
    try {
        const aoTheComputerConfig = {
            TWITTER_DRY_RUN:
                parseBooleanFromText(
                    runtime.getSetting("TWITTER_DRY_RUN") ||
                        process.env.TWITTER_DRY_RUN
                ) ?? false, // parseBooleanFromText return null if "", map "" to false

            AO_USERNAME:
                runtime.getSetting("AO_USERNAME") ||
                process.env.AO_USERNAME,

            AO_PROFILE_CONTRACT:
                runtime.getSetting("AO_PROFILE_CONTRACT") ||
                process.env.AO_PROFILE_CONTRACT,

            AO_ROUTING_CONTRACT:
                runtime.getSetting("AO_ROUTING_CONTRACT") ||
                process.env.AO_ROUTING_CONTRACT,

            // number as string?
            MAX_TWEET_LENGTH: safeParseInt(
                runtime.getSetting("MAX_TWEET_LENGTH") ||
                    process.env.MAX_TWEET_LENGTH,
                DEFAULT_MAX_TWEET_LENGTH
            ),

            AO_SEARCH_ENABLE:
                parseBooleanFromText(
                    runtime.getSetting("AO_SEARCH_ENABLE") ||
                        process.env.AO_SEARCH_ENABLE
                ) ?? false,

            // int
            TWITTER_RETRY_LIMIT: safeParseInt(
                runtime.getSetting("TWITTER_RETRY_LIMIT") ||
                    process.env.TWITTER_RETRY_LIMIT,
                5
            ),

            // int in seconds
            TWITTER_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("TWITTER_POLL_INTERVAL") ||
                    process.env.TWITTER_POLL_INTERVAL,
                120 // 2m
            ),

            // int in minutes
            POST_INTERVAL_MIN: safeParseInt(
                runtime.getSetting("POST_INTERVAL_MIN") ||
                    process.env.POST_INTERVAL_MIN,
                90 // 1.5 hours
            ),

            // int in minutes
            POST_INTERVAL_MAX: safeParseInt(
                runtime.getSetting("POST_INTERVAL_MAX") ||
                    process.env.POST_INTERVAL_MAX,
                180 // 3 hours
            ),

            // bool
            ENABLE_ACTION_PROCESSING:
                parseBooleanFromText(
                    runtime.getSetting("ENABLE_ACTION_PROCESSING") ||
                        process.env.ENABLE_ACTION_PROCESSING
                ) ?? false,

            // init in minutes (min 1m)
            ACTION_INTERVAL: safeParseInt(
                runtime.getSetting("ACTION_INTERVAL") ||
                    process.env.ACTION_INTERVAL,
                5 // 5 minutes
            ),

            // bool
            POST_IMMEDIATELY:
                parseBooleanFromText(
                    runtime.getSetting("POST_IMMEDIATELY") ||
                        process.env.POST_IMMEDIATELY
                ) ?? false,
        };

        console.log(`----- AO CONFIG`, aoTheComputerConfig)

        return aoTheComputerEnvSchema.parse(aoTheComputerConfig);
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `X/AoTheComputer configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
