import {
    ActionExample,
    Content,
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
import {aoClientProvider} from "../aoClientProvider.ts";
import { ClaraProfile, TOPICS } from "redstone-clara-sdk";


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

{{recentMessages}}

# INSTRUCTIONS: Generate a task. You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actions}}

# INSTRUCTIONS: Generate a strategy. You MUST include a strategy from the available below
- 'cheapest'
- 'leastOccupied'
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
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating :", message.userId);
        return true;
    },
    description: "C.L.A.R.A Use CLARA_TASK always. Whenever someone requests a task, related to post, tweet or any task. Always.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_TOKEN handler...");
        console.log("== TASK 5", TOPICS);
        console.log("== message", message.roomId, message.content);
        console.log("== Callback == ", callback);


        state.actions = TOPICS.join(', ')
        console.log("== actions", state.actions);
        const aoProfile = await aoClientProvider.get(runtime, message, state);
        // async registerTask({topic, reward, matchingStrategy, payload, contextId = null}) {


        // // Define the schema for the expected output
        const taskSchema = z.object({
            action: z.string(),
            payload: z.string(),
            strategy: z.string()
        });

        // Compose transfer context
        const context = composeContext({
            state,
            template: claraTaskTemplate,
        });

        // Generate transfer content with the schema
        const task = await generateObject({
            runtime,
            context: context,
            schema: taskSchema,
            modelClass: ModelClass.SMALL,
        });

        let result = await aoProfile.registerTask({
            topic: task.action,
            reward: 10,
            matchingStrategy: task.strategy,
            payload: task.payload
        });

        // Validate transfer content
        console.log("== result", result);
        if (callback) {
            callback({
                text: "Task scheduled: https://www.ao.link/#/message/" + result.taskId,
                content: result,
            });
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
