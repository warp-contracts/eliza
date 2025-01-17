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

    conversationId: '123';
}

export type NodeType = {
    id: string;
    tags: TagType[];
    data: {
        size: string;
        type: string;
        value?: string;
    };
    ingested_at: number;
    url?: string,
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
