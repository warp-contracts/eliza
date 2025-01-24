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
import { claraProfileProvider } from "../clara/ClaraProfileProvider.ts";
import { TOPICS, MATCHERS } from "redstone-clara-sdk";

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
    "action_count": number,
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
        try {
            await claraProfileProvider.get(runtime, message);
        } catch {
            elizaLogger.error("Failed to load ao client profile");
            return false;
        }
        return true;
    },
    description:
        "C.L.A.R.A, Use CLARA_TASK always if there is any mention of task, request, order, clara task or clara protocol.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CLARA_TASK handler...");

        const claraProfile = await claraProfileProvider.get(
            runtime,
            message,
            state
        );

        // // Define the schema for the expected output
        const taskSchema = z.object({
            action: z.string(),
            payload: z.string(),
            strategy: z.string(),
            action_count: z.number(),
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

        // Sending request using CLARA SDK
        const responses = {};
        let tasksCount = taskObject.action_count || 1;
        if (tasksCount > 5) {
            tasksCount = 5;
        }
        if (tasksCount < 0) {
            tasksCount = 1;
        }
        try {
            for (let i = 1; i <= tasksCount; i++) {
                const result = await claraProfile.registerTask({
                    topic: taskObject.action,
                    reward: 10,
                    matchingStrategy: taskObject.strategy,
                    payload: taskObject.payload,
                });
                elizaLogger.debug(`${i} task registered`, result);
                responses[result.taskId] = formatTaskAssigment(i, result);
            }
        } catch (e) {
            elizaLogger.error(
                `AO plugin: failed to send request using CLARA SDK`,
                message.content,
                e
            );
            if (callback) {
                callback({
                    text: `Cannot send CLARA request`,
                    content: "",
                });
            }
            return false;
        }

        try {
            await pollTaskResult(claraProfile, Object.keys(responses)).then(
                (res) => {
                    elizaLogger.debug(`updating message`, res);
                    for (const [key, value] of Object.entries(res)) {
                        responses[key] =
                            responses[key] + formatTwitterMessage(value);
                    }
                }
            );
            if (callback) {
                callback({
                    text: Object.values(responses).join(
                        "\n\n-----------------------\n\n"
                    ),
                });
            }
            return true;
        } catch (e) {
            elizaLogger.error(
                `AO plugin: failed to fetch request result using CLARA SDK`,
                message.content,
                e
            );
            if (callback) {
                callback({
                    text: Object.values(responses).join(
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

function formatTaskAssigment(i: number, result): string {
    return `-- Task ${i} \nAssigned to ${result?.assignedAgentId}\nFee: ${result?.fee}
        \nC.L.A.R.A. req: https://www.ao.link/#/message/${result?.taskId}\n`;
}

function formatTwitterMessage(res): string {
    return `\nX: https://x.com/${res?.result?.userName}/status/${res?.result?.id}\n`;
}

async function pollTaskResult(
    claraProfile,
    reqTaskId: Array<string>,
    interval = 10,
    duration = 300
) {
    const startTime = Date.now();
    let total = reqTaskId.length;
    const results = {};

    return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
            const elapsedTime = Date.now() - startTime;

            if (elapsedTime >= duration * 1000) {
                clearInterval(intervalId);
                resolve(results);
                return;
            }

            try {
                const taskResult = await claraProfile.loadNextTaskResult();
                elizaLogger.debug(`next task result`, taskResult);
                if (taskResult && reqTaskId.includes(taskResult.id)) {
                    total -= 1;
                    results[taskResult.id] = taskResult;
                    if (total <= 0) {
                        clearInterval(intervalId);
                        resolve(results);
                    }
                }
            } catch (error) {
                clearInterval(intervalId);
                reject(error);
            }
        }, interval * 1000);
    });
}
