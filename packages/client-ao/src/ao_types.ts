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

export const GQL_TXS_QUERY =
    "query ($entityId: String!, $limit: Int!, $sortOrder: SortOrder!, $cursor: String) {\n" +
    "  transactions(\n" +
    "    sort: $sortOrder\n" +
    "    first: $limit\n" +
    "    after: $cursor\n" +
    "    recipients: [$entityId]\n" +
    "    ingested_at: {min: 1696107600}\n" +
    "  ) {\n" +
    "    count\n" +
    "    ...MessageFields\n" +
    "    __typename\n" +
    "  }\n" +
    "}\n" +
    "fragment MessageFields on TransactionConnection {\n" +
    "  edges {\n" +
    "    cursor\n" +
    "    node {\n" +
    "      id\n" +
    "      ingested_at\n" +
    "      recipient\n" +
    "      block {\n" +
    "        timestamp\n" +
    "        height\n" +
    "        __typename\n" +
    "      }\n" +
    "      tags {\n" +
    "        name\n" +
    "        value\n" +
    "        __typename\n" +
    "      }\n" +
    "      data {\n" +
    "        size\n" +
    "        __typename\n" +
    "      }\n" +
    "      owner {\n" +
    "        address\n" +
    "        __typename\n" +
    "      }\n" +
    "      __typename\n" +
    "    }\n" +
    "    __typename\n" +
    "  }\n" +
    "  __typename\n" +
    "}";
