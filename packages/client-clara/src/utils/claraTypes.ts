export type ClaraTaskType = {
    id: string;
    requester: string;
    originalId: string;
    matchingStrategy: string;
    agentId: string;
    contextId: string;
    topic: string;
    timestamp: number;
    requesterId: string;
    reward: string;
    payload: string;
    block?: number;
    blockNumber?: number;
};
