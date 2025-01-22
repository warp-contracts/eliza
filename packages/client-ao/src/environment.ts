import { parseBooleanFromText, IAgentRuntime } from "@elizaos/core";
import { z, ZodError } from "zod";

export const AO_DEFAULT_MAX_MESSAGE_LENGTH = 280;

/**
 * This schema defines all required/optional environment settings
 */
export const aoEnvSchema = z.object({
    AO_USERNAME: z.string().min(1, "AO username is required"),
    AO_WALLET: z.string().min(1, "AO wallet is required"),
    AO_WALLET_ID: z.string().min(1, "AO wallet id is required"),
    AO_MARKET_ID: z.string().min(1, "AO market protocol id is required"),
    AO_MAX_MESSAGE_LENGTH: z
        .number()
        .int()
        .default(AO_DEFAULT_MAX_MESSAGE_LENGTH),
    AO_RETRY_LIMIT: z.number().int(),
    AO_POLL_INTERVAL: z.number().int(),
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
                                'Invalid AO username format'
                            )
                    )
                )
                .transform((users) => users.join(','))
        )
        .optional()
        .default(''),
    */
    AO_MESSAGE_INTERVAL_MIN: z.number().int(),
    AO_MESSAGE_INTERVAL_MAX: z.number().int(),
    AO_ENABLE_ACTION_PROCESSING: z.boolean(),
    AO_ACTION_INTERVAL: z.number().int(),
    AO_MESSAGE_IMMEDIATELY: z.boolean(),
});

export type AoConfig = z.infer<typeof aoEnvSchema>;

function safeParseInt(
    value: string | undefined | null,
    defaultValue: number
): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : Math.max(1, parsed);
}

/**
 * Validates or constructs AO config object using zod,
 * taking values from the IAgentRuntime or process.env as needed.
 */
// This also is organized to serve as a point of documentation for the client
// most of the inputs from the framework (env/character)

// we also do a lot of typing/parsing here
// so we can do it once and only once per character
export async function validateAoConfig(
    runtime: IAgentRuntime
): Promise<AoConfig> {
    try {
        const aoConfig = {
            AO_USERNAME:
                runtime.getSetting("AO_USERNAME") || process.env.AO_USERNAME,

            AO_WALLET: runtime.getSetting("AO_WALLET") || process.env.AO_WALLET,

            AO_WALLET_ID:
                runtime.getSetting("AO_WALLET_ID") || process.env.AO_WALLET_ID,

            AO_MARKET_ID:
                runtime.getSetting("AO_MARKET_ID") || process.env.AO_MARKET_ID,

            // number as string?
            AO_MAX_MESSAGE_LENGTH: safeParseInt(
                runtime.getSetting("AO_MAX_MESSAGE_LENGTH") ||
                    process.env.AO_MAX_MESSAGE_LENGTH,
                AO_DEFAULT_MAX_MESSAGE_LENGTH
            ),

            // int
            AO_RETRY_LIMIT: safeParseInt(
                runtime.getSetting("AO_RETRY_LIMIT") ||
                    process.env.AO_RETRY_LIMIT,
                5
            ),

            // int in seconds
            AO_POLL_INTERVAL: safeParseInt(
                runtime.getSetting("AO_POLL_INTERVAL") ||
                    process.env.AO_POLL_INTERVAL,
                120 // 2m
            ),

            // int in minutes
            AO_MESSAGE_INTERVAL_MIN: safeParseInt(
                runtime.getSetting("AO_MESSAGE_INTERVAL_MIN") ||
                    process.env.AO_MESSAGE_INTERVAL_MIN,
                90 // 1.5 hours
            ),

            // int in minutes
            AO_MESSAGE_INTERVAL_MAX: safeParseInt(
                runtime.getSetting("AO_MESSAGE_INTERVAL_MAX") ||
                    process.env.AO_MESSAGE_INTERVAL_MAX,
                180 // 3 hours
            ),

            // bool
            AO_MESSAGE_IMMEDIATELY:
                parseBooleanFromText(
                    runtime.getSetting("AO_MESSAGE_IMMEDIATELY") ||
                        process.env.AO_MESSAGE_IMMEDIATELY
                ) ?? false,

            // init in minutes (min 1m)
            AO_ACTION_INTERVAL: safeParseInt(
                runtime.getSetting("AO_ACTION_INTERVAL") ||
                    process.env.AO_ACTION_INTERVAL,
                5 // 5 minutes
            ),

            // bool
            AO_ENABLE_ACTION_PROCESSING:
                parseBooleanFromText(
                    runtime.getSetting("AO_ENABLE_ACTION_PROCESSING") ||
                        process.env.AO_ENABLE_ACTION_PROCESSING
                ) ?? false,
        };

        return aoEnvSchema.parse(aoConfig);
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
