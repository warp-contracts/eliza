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

export type NodeType = {
    id: string;
    tags: TagType[];
    data: {
        size: string;
        type: string;
        value?: string;
    };
    block?: {
        height: number;
        timestamp: number;
    };
    owner?: {
        address: string;
    };
    address?: string;
    timestamp?: number;
};
