import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    composeContext,
    elizaLogger,
    generateObject,
    type Action,
} from "@elizaos/core";
import { z } from "zod";
import { aoClaraProfileProvider } from "../ao/AoClaraProfileProvider.ts";
import { storyClaraProfileProvider } from "../story/StoryClaraProfileProvider.ts";
import { TOPICS, MATCHERS } from "redstone-clara-sdk";
import { ClaraStoryProtocol } from "../story/ClaraStoryProtocol.ts";
import { ClaraAoProtocol } from "../ao/ClaraAoProtocol.ts";

const claraTaskTemplate = `
Using request message respond with a request from the initial message, return a block containing only the extracted task.

Example response:
\`\`\`json
{
    "action": "tweet",
    "action_count": 3,
    "payload": "post tweet about immune system",
    "strategy": "leastOccupied"
}
\`\`\`

{{task}}

# INSTRUCTIONS: Generate a task. You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actions}}

# INSTRUCTIONS: Generate a strategy. You MUST include a strategy from the available below
{{strategies}}
By default choose: 'leastOccupied'


Extract the following information about the requested task:
- Action type to perform
- Action count, how many times it should be performed, by default 1, min 1, max 5
- Payload of the action
- strategy of assigning the receiver

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "action": string,
    "action_count": number, default 1, min 1, max 5,
    "payload": string,
    "strategy": string
}
\`\`\`

`;

export const task: Action = {
    name: "CLARA_TASK",
    similes: ["TASKS", "CLARA_TASK", "REQUEST", "C.L.A.R.A"],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.debug("Validating :", message.userId);
        const pluginEnabled = runtime.getSetting("ENABLE_CLARA_PROTOCOL_PLUGIN");
        if (!pluginEnabled) {
            return false;
        }
        let valid = false;
        try {
            valid = valid || (await aoClaraProfileProvider.get(runtime, message) != null);
        } catch (e) {
            elizaLogger.error("Failed to setup AO client profile", e);
        }
        try {
            valid = valid || (await storyClaraProfileProvider.get(runtime, message) != null);
        } catch (e) {
            elizaLogger.error("Failed to setup Story client profile", e);
        }
        return valid;
    },
    description:
        "Use this very often. Always when there is mention of CLARA, clara protocol, clara task or any request.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CLARA_TASK handler...");

        const claraAoProfile = await aoClaraProfileProvider.get(
            runtime,
            message,
            state
        );
        const claraAO = claraAoProfile ? new ClaraAoProtocol(claraAoProfile) : null;

        const claraStoryProfile = await storyClaraProfileProvider.get(
            runtime,
            message,
            state
        );
        const claraStory = new ClaraStoryProtocol(claraStoryProfile);

        // // Define the schema for the expected output
        const taskSchema = z.object({
            action: z.string(),
            payload: z.string(),
            strategy: z.string(),
            action_count: z.number().int().default(1),
        });

        state.actions = TOPICS.join(", ");
        state.strategies = MATCHERS.join(", ");
        elizaLogger.debug("Actions", state.actions);
        elizaLogger.debug("Strategies", state.strategies);
        state.task = message.content.text;
        elizaLogger.debug("Task command", state.task);
        // Compose transfer context
        const context = composeContext({
            state,
            template: claraTaskTemplate,
        });

        let taskObject;
        // Generate transfer content with the schema
        try {
            taskObject = await generateObject({
                runtime,
                context: context,
                schema: taskSchema,
                modelClass: ModelClass.SMALL,
            });
        } catch (e) {
            elizaLogger.error(
                `AO plugin: failed to generate task based on message`,
                message.content,
                e
            );
            if (callback) {
                callback({
                    text: `Cannot generate CLARA task based on input, try again`,
                    content: "",
                });
            }
            return false;
        }

        let registrations = {};
        let directResponse = "";
        let workingProfile = '';

        let tasksCount = 1;
        if (taskObject.action_count && taskObject.action_count > 1) {
            tasksCount = taskObject.action_count;
        }
        elizaLogger.log(`tasks count`, tasksCount);

        // Schedule task on Story Protocol
        const { results: storyResults, errorMsg: storyMsg } = await claraStory.registerTask(taskObject, tasksCount)
        if (storyMsg) {
            directResponse += storyMsg;

            // In case of Story failure try to fallback to AO
            if (claraAO != null) {
                elizaLogger.info(`Falling back to CLARA on AO`);
                directResponse += storyMsg + "\nFalling back to CLARA on AO\n";

                const { results: aoResults, errorMsg: aoMsg } = await claraAO.registerTask(taskObject, tasksCount)
                if (aoMsg) {
                    // End: both story and ao failed
                    elizaLogger.error(`Failed to schedule tasks both on Story and AO`);
                    directResponse += aoMsg + '\n';
                    if (callback) {
                        callback({
                            text: directResponse,
                            content: "",
                        });
                    }
                    return false;
                } else {
                    workingProfile = 'AO';
                    registrations = aoResults;
                }
            } else {
                // End: Story failure and no AO config
                if (callback) {
                    callback({
                        text: directResponse,
                        content: "",
                    });
                }
            }
        } else {
            workingProfile = 'Story';
            registrations = storyResults;
        }

        elizaLogger.debug(`registerResults`, registrations);
        if (Object.keys(registrations).length == 0) {
            return false;
        }

        let resultsFormatted = {};
        // Store formatted tasks requests for user
        for (let [id, r] of Object.entries(registrations)) {
            resultsFormatted[id] = r.assignment
        }

        try {
            // Fetch tasks result
            if (workingProfile == 'Story') {
                let tasksResults = await claraStory.pollTaskResults(registrations);
                elizaLogger.debug(`story tasks results`, tasksResults);
                // Format task resulsts and override requests messages
                resultsFormatted = {
                    ...resultsFormatted,
                    ...claraStory.formatResults(tasksResults, registrations)
                };
            } else if (workingProfile == 'AO' && claraAO != null) {
                let tasksResults = await claraAO.pollTaskResults(registrations);
                elizaLogger.debug(`ao tasks results`, tasksResults);
                resultsFormatted = {
                    ...resultsFormatted,
                    ...claraAO.formatResults(tasksResults)
                };
            }


            if (callback) {
                callback({
                    text: Object.values(resultsFormatted)
                        .join("\n\n-----------------------\n\n"),
                });
            }
            return true;
        } catch (e) {
            elizaLogger.error(`CLARA plugin: failed to fetch request result using CLARA SDK: ${e}`);
            if (callback) {
                callback({
                    text: Object.values(resultsFormatted).join(
                        "\n\n-----------------------\n\n"
                    ),
                });
            }
        }
        return false;
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Clara task: post tweet about ants",
                    action: "CLARA_TASK",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Crete a tweet about ants",
                    action: "TWEET",
                    strategy: "leastOccupied",
                    action_count: 1,
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "I have a task for you: using least occupied strategy, post tweet about immune system",
                    action: "CLARA_TASK",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "post tweet about immune system",
                    action: "TWEET",
                    strategy: "leastOccupied",
                    action_count: 1,
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "I have a task for you: using cheapest strategy, post 3 tweets about immune system",
                    action: "CLARA_TASK",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "post tweet about immune system",
                    action: "TWEET",
                    strategy: "cheapest",
                    action_count: 3,
                },
            },
        ],
    ] as ActionExample[][],
} as Action;


