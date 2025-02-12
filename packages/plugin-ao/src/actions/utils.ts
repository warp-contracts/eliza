
export function formatTaskAssigment(i: number, result): string {
    if (result?.numberOfAgents && result.numberOfAgents > 1) {
        return `-- Task ${i} \Assigned to: ${result.numberOfAgents} agents\n`;
    } else {
        return `-- Task ${i} \nReward: ${result?.fee}
            \nC.L.A.R.A. req: https://www.ao.link/#/message/${result?.originalMsgId}\n`;
    }
}

export function formatTaskResult(taskResultId: string, result): string {
    return `\n-- Task: ${result?.originalTaskId}
        \nResult ${taskResultId} \nAssigned to ${result?.assignedAgentId}\nFee: ${result?.fee}
        \nC.L.A.R.A. req: https://www.ao.link/#/message/${result?.originalTaskId}\n`;
}

export function formatTwitterMessage(res): string {
    return `\nX: https://x.com/${res?.userName}/status/${res?.id}\n`;
}

