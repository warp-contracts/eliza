import { ClaraProfileStory } from "redstone-clara-sdk";
import {
    elizaLogger,
} from "@elizaos/core";
import { formatTwitterMessage } from "../actions/utils";

export class ClaraStoryProtocol {
    readonly profile: ClaraProfileStory;

    constructor(claraStoryProfile: ClaraProfileStory) {
        this.profile = claraStoryProfile;
    }

    async registerTask(taskObject, tasksCount) {
        const results = {};
        let errorMsg;

        try {
            elizaLogger.log(`ClaraStory: attemping to register tasks`);
            let reward = 0.1 * Math.pow(10, 18);

            for (let i = 1; i <= tasksCount; i++) {
                let requestTask = {
                    topic: taskObject.action,
                    reward,
                    matchingStrategy: taskObject.strategy,
                    payload: taskObject.payload,
                };
                elizaLogger.debug(`Task ${i}`, requestTask);
                const { txHash, blockNumber, task } = await this.profile.registerTask(requestTask);
                elizaLogger.debug(`${i} Story task registered`, txHash, task);
                results[task.id] = {
                    numberOfAgents: 1,
                    reward: reward / Math.pow(10, 18),
                    agentId: task.agentId,

                    blockNumber,
                    txHash,
                    assignment: this.formatStoryTaskAssigment(i, {
                        txHash,
                        numberOfAgents: 1,
                        fee: reward / Math.pow(10, 18)
                    }),
                };
            }
        } catch (e) {
            console.log(e);
            elizaLogger.error(`CLARA plugin: failed to send request using CLARA SDK on Story`, e);
            errorMsg = `Failed to schedule CLARA tasks on Story`;
        }
        return { results, errorMsg }
    }


    formatStoryTaskAssigment(i: number, result): string {
        if (result?.numberOfAgents && result.numberOfAgents > 1) {
            return `-- Task ${i} \Assigned to: ${result.numberOfAgents} agents\n`;
        } else {
            return `-- Task ${i} \nReward: ${result?.fee}
            \nC.L.A.R.A. req: https://aeneid.storyscan.xyz/tx/${result.txHash}\n`;
        }
    }

    async pollTaskResults(responses: any, interval = 10, duration = 300) {
        const startTime = Date.now();
        let total = 0;
        let cursor = 0;
        const reqTaskId = Object.keys(responses);
        console.log("reqTaskId", reqTaskId);
        reqTaskId.forEach((key: string) => {
            total += parseInt(responses[key].numberOfAgents);
            if (cursor == 0) {
                cursor = responses[key].blockNumber;
            } else if (responses[key].blockNumber < cursor) {
                cursor = responses[key].blockNumber;
            }
        });
        console.log("total", total);
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
                    const loadTaskResult = (await this.profile.loadNextTaskResult(cursor));
                    cursor = loadTaskResult.cursor;
                    elizaLogger.debug(`next task `, loadTaskResult);
                    if (loadTaskResult.result) {
                        if (reqTaskId.includes(loadTaskResult.result.id.toString())) {
                            elizaLogger.debug(`found req task`, loadTaskResult.result.id);
                            total -= 1;

                        }
                        let taskResult = {};
                        try {
                            taskResult = JSON.parse(loadTaskResult.result.result);
                        } catch (e) {
                            elizaLogger.error(`Failed to parse task result`, loadTaskResult)
                        }
                        results[loadTaskResult.result.id] = taskResult;

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

    formatResults(tasks, registerResults) {
        const responses = {};
        for (const [key, value] of Object.entries(tasks)) {
            elizaLogger.debug(`key value`, key, value, registerResults[key]);
            responses[key] =
                formatTwitterMessage(value) +
                this.formatTaskResult(key, registerResults[key]);
        }
        return responses;
    }

    formatTaskResult(taskResultId: string, result): string {
        return `\n-- Task Result: ${taskResultId}
            \nAssigned to\nhttps://aeneid.storyscan.xyz/address/${result?.agentId}\n\nFee: ${result?.reward}
            \nC.L.A.R.A. req: https://aeneid.storyscan.xyz/tx/${result?.txHash}\n`;
    }
}
