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
            elizaLogger.error(`CLARA plugin: failed to send request using CLARA SDK on Story: ${e}`);
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
        let blockNumber = 0;
        const reqTaskId = Object.keys(responses);
        elizaLogger.debug("Requested tasks ids", reqTaskId);
        reqTaskId.forEach((key: string) => {
            total += parseInt(responses[key].numberOfAgents);
            if (blockNumber == 0) {
                blockNumber = responses[key].blockNumber;
            } else if (responses[key].blockNumber < blockNumber) {
                blockNumber = responses[key].blockNumber;
            }
        });
        const results = {};

        return new Promise((resolve, reject) => {
            let cursor = blockNumber;
            const intervalId = setInterval(async () => {
                const elapsedTime = Date.now() - startTime;

                if (elapsedTime >= duration * 1000) {
                    clearInterval(intervalId);
                    resolve(results);
                    return;
                }

                try {
                    const { cursor: nextCursor, txHash, result: loadedTask } = (await this.profile.loadNextTaskResult(cursor));
                    cursor = nextCursor;
                    elizaLogger.debug(`next task, hash ${txHash}: `, loadedTask);
                    if (loadedTask) {
                        if (reqTaskId.includes(loadedTask.id.toString())) {
                            elizaLogger.debug(`found req task`, loadedTask.id);
                            total -= 1;
                        }
                        let result = {};
                        try {
                            result = JSON.parse(loadedTask.result);
                        } catch (e) {
                            elizaLogger.error(`Failed to parse task result`, loadedTask.result)
                        }
                        results[loadedTask.id] = {
                            result,
                            txHash
                        };

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
                `\n-- Task Result \n` +
                formatTwitterMessage(value.result) +
                this.formatTaskResult(registerResults[key], value);
        }
        return responses;
    }

    formatTaskResult(registration, result): string {
        return `
            \nAssigned to\nhttps://aeneid.storyscan.xyz/address/${registration?.agentId}\n\nFee: ${registration?.reward}
            \nResult: https://aeneid.storyscan.xyz/tx/${result?.txHash}
            \nReq: https://aeneid.storyscan.xyz/tx/${registration?.txHash}\n`;
    }
}
