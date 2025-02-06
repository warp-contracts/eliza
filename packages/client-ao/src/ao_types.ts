export type AoSigner = {
    (
        args_0: {
            data?: any;
            tags?: { value?: string; name?: string }[];
            anchor?: string;
            target?: string;
        },
        ...args: unknown[]
    ): Promise<{ id?: string; raw?: any }>;
};

export type TagType = { name: string; value: string };

export type Message = {
    id: string;
    owner?: {
        address: string;
        key: string;
    };
    data: string;
    tags: TagType[];
    signature: string;
    target: string;
};

export type NodeDataType = {
    size: string;
    type: string;
    value?: string;
};

export type NodeType = {
    id: string;
    tags: TagType[];
    data: NodeDataType;
    ingested_at: number;
    url?: string;
    block?: {
        height: number;
        timestamp: number;
    };
    owner?: {
        address: string;
    };
    address?: string;
    conversationId: string;
};

export type AoTaskType = {
    id: string;
    requester: string;
    originalId: string;
    matchingStrategy: string;
    block: number;
    agentId: string;
    contextId: string;
    topic: string;
    timestamp: number;
    requesterId: string;
    reward: string;
    payload: string;
};
