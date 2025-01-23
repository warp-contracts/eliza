import { createDataItemSigner } from "@permaweb/aoconnect";
import { AoSigner, NodeType } from "./ao_types.ts";
import { GQL_TX_QUERY, GQL_TXS_QUERY } from "./ao_graphql_query.ts";
import { Content, elizaLogger } from "@elizaos/core";
import { AoClaraMarket } from "./AoClaraMarket.ts";

export class AoClient {
    profileId: string;
    walletId: string;
    signer: AoSigner;
    claraMarket: AoClaraMarket;

    constructor(profileId: string, walletId: string) {
        this.profileId = profileId;
        this.walletId = walletId;
        this.claraMarket = new AoClaraMarket(this.profileId);
    }

    async init() {
        this.signer = createDataItemSigner(JSON.parse(process.env.AO_WALLET));
        await this.claraMarket.init();
    }

    async sendTaskResult(taskId: string, result: Content) {
        try {
            const response = await this.claraMarket.profile.sendTaskResult({
                taskId,
                result,
            });
            elizaLogger.info(
                `Task result for id: ${taskId} sent`,
                JSON.stringify(response)
            );
            return response;
        } catch (e) {
            elizaLogger.error(
                `Could not send task result for task: ${taskId}.`,
                e
            );
            return false;
        }
    }

    async getMessage(messageId: string): Promise<NodeType> {
        elizaLogger.log(`AO Client getMessage`, messageId);
        const messageRes = await fetch(
            "https://arweave-search.goldsky.com/graphql",
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: GQL_TX_QUERY,
                    variables: {
                        id: messageId,
                    },
                }),
            }
        ).then((res) => res.json());

        const message = messageRes.data.transaction;
        message.data.value = await this.getMessageData(messageId);

        return message;
    }

    async getMessageData(messageId: string): Promise<string> {
        return await fetch(`https://arweave.net/${messageId}`).then((res) =>
            res.text()
        );
    }

    async fetchIncomingMessages(count: number): Promise<NodeType[]> {
        elizaLogger.log(
            `AO Client getMessages`,
            this.profileId,
            this.walletId,
            count
        );
        const reqBody = {
            query: GQL_TXS_QUERY,
            variables: {
                cursor: "",
                entityId: this.walletId,
                limit: count,
                sortOrder: "INGESTED_AT_DESC",
                processId: process.env.AO_MARKET_ID,
            },
        };

        const messageResponse = await fetch(
            "https://arweave-search.goldsky.com/graphql",
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(reqBody),
            }
        ).then((res) => res.json());
        const messages = messageResponse.data.transactions.edges.map(
            (e) => e.node
        );

        for (const m of messages) {
            m.data.value = await this.getMessageData(m.id);
            m.conversationId = m.id;
        }

        return messages;
    }
}
