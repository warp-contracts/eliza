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
import {aoClientProvider} from "../clara/AoClientProvider.ts";
import { TOPICS, MATCHERS } from "redstone-clara-sdk";


const claraTaskTemplate = `
Using request message respond with a request from the initial message, return a block containing only the extracted task.

Example response:
\`\`\`json
{
    "action": "tweet",
    "payload": "post tweet about immune system",
    "strategy": "cheapest"
}
\`\`\`

{{task}}

# INSTRUCTIONS: Generate a task. You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actions}}

# INSTRUCTIONS: Generate a strategy. You MUST include a strategy from the available below
{{strategies}}
By default choose: 'cheapest'


Extract the following information about the requested task:
- Action to perform
- Payload of the action
- strategy of assigning the receiver

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "action": string,
    "payload": string,
    "strategy": string
}
\`\`\`

`;

export const task: Action = {
    name: "CLARA_TASK",
    similes: [
        "TASKS", "CLARA_TASK", "REQUEST", "C.L.A.R.A"
    ],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating :", message.userId);
        try {
            await aoClientProvider.get(runtime, message);
        } catch {
            elizaLogger.error("Failed to load ao client profile");
            return false;
        }
        return true;
    },
    description: "C.L.A.R.A, Use CLARA_TASK always if there is any mention of task, request, order, clara task or clara protocol.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CLARA_TASK handler...");

        const aoProfile = await aoClientProvider.get(runtime, message, state);

        // // Define the schema for the expected output
        const taskSchema = z.object({
            action: z.string(),
            payload: z.string(),
            strategy: z.string()
        });

        state.actions = TOPICS.join(', ')
        state.strategies = MATCHERS.join(', ')
        elizaLogger.debug("Actions", state.actions)
        elizaLogger.debug("Strategies", state.strategies)
        state.task = message.content.text
        elizaLogger.debug("Task command", state.task)
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
            elizaLogger.error(`AO plugin: failed to generate task based on message`, message.content, e);
            if (callback) {
                callback({
                    text: `Cannot generate CLARA task based on input, try again`,
                    content: '',
                });
            }
            return false;
        }


        // Sending request using CLARA SDK
        try {
            const result = await aoProfile.registerTask({
                topic: taskObject.action,
                reward: 10,
                matchingStrategy: taskObject.strategy,
                payload: taskObject.payload
            });
            console.log("== result", result);


            if (callback) {
                callback({
                    text:
                        `Task scheduled: https://www.ao.link/#/message/${result.taskId}.
                        ${ result.assignedAgentId ? `\nAssigned to ${result.assignedAgentId}` : ''}`,
                    content: result,
                });
            }
            return true;
        } catch (e) {
            elizaLogger.error(`AO plugin: failed to send request using CLARA SDK`, message.content, e);
            if (callback) {
                callback({
                    text: `Cannot send CLARA request`,
                    content: '',
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
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "I have a task for you: post tweet about immune system",
                    action: "CLARA_TASK",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "post tweet about immune system",
                    action: "TWEET",
                },
            }
        ],
    ] as ActionExample[][],
} as Action;
