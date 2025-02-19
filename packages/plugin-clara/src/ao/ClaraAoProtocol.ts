import { ClaraProfileAO } from "redstone-clara-sdk";
import {
    elizaLogger,
} from "@elizaos/core";
import { formatTwitterMessage } from "../actions/utils";

export class ClaraAoProtocol {
    readonly profile: ClaraProfileAO;

    constructor(claraStoryProfile: ClaraProfileAO) {
        this.profile = claraStoryProfile;
    }

    async registerTask(taskObject, tasksCount) {
        const results = {};
        let errorMsg;

        try {
            for (let i = 1; i <= tasksCount; i++) {
                const result = await this.profile.registerTask({
                    topic: taskObject.action,
                    reward: 100,
                    matchingStrategy: taskObject.strategy,
                    payload: taskObject.payload,
                });
                elizaLogger.debug(`${i} AO task registered`, result);
                results[result.originalMsgId] = {
                    numberOfAgents: result.numberOfAgents,
                    assignment: this.formatTaskAssigment(i, result),
                };
            }
        } catch (e) {
            elizaLogger.error(`CLARA plugin: failed to send request using CLARA SDK on AO: ${e}`, e);
            errorMsg += `Failed to schedule CLARA tasks on AO`
        }
        return { results, errorMsg }
    }


    formatTaskAssigment(i: number, result): string {
        if (result?.numberOfAgents && result.numberOfAgents > 1) {
            return `-- Task ${i} \Assigned to: ${result.numberOfAgents} agents\n`;
        } else {
            return `-- Task ${i} \nReward: ${result?.fee}
                \nC.L.A.R.A. req: https://www.ao.link/#/message/${result?.originalMsgId}\n`;
        }
    }

    async pollTaskResults(responses: any, interval = 10, duration = 300) {
        const startTime = Date.now();
        let total = 0;
        const reqTaskId = Object.keys(responses);
        reqTaskId.forEach((key: string) => {
            total += parseInt(responses[key].numberOfAgents);
        });
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
                    const taskResult = await this.profile.loadNextTaskResult();
                    elizaLogger.debug(`next task result`, taskResult);
                    if (taskResult) {
                        const foundReqTask = reqTaskId.find((r) =>
                            taskResult.id.includes(r)
                        );
                        elizaLogger.debug(`found req task`, foundReqTask);
                        if (foundReqTask) {
                            total -= 1;
                            results[foundReqTask] = {
                                ...results[foundReqTask],
                                [taskResult.id]: taskResult,
                            };
                            if (total <= 0) {
                                clearInterval(intervalId);
                                resolve(results);
                            }
                        }
                    }
                } catch (error) {
                    clearInterval(intervalId);
                    reject(error);
                }
            }, interval * 1000);
        });
    }

    formatResults(tasks) {
        let responses = {};
        elizaLogger.debug(`tasks results`, tasks);
        for (const [key, value] of Object.entries(tasks)) {
            for (const [key2, value2] of Object.entries<any>(value)) {
                responses[key][key2] =
                    formatTwitterMessage(value2.result) +
                    this.formatTaskResult(key2, {
                        key,
                        fee: value2?.originalTask?.reward,
                        assignedAgentId: value2?.agentId,
                        originalTaskId:
                            value2?.originalTask?.originalId,
                    });
            }
        }
        return responses;
    }


    formatTaskResult(taskResultId: string, result): string {
        return `\n-- Task: ${result?.originalTaskId}
        \nResult ${taskResultId} \nAssigned to ${result?.assignedAgentId}\nFee: ${result?.fee}
        \nC.L.A.R.A. req: https://www.ao.link/#/message/${result?.originalTaskId}\n`;
    }
}
