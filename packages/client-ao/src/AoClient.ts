import { SearchMode } from "agent-twitter-client";
import { createDataItemSigner, dryrun, message } from "@permaweb/aoconnect";
import { AoSigner, GQL_TXS_QUERY, NodeType } from "./ao_types.ts";

export class AoClient {
    profileContractId: string;
    signer: AoSigner;

    constructor(profileContractId: string) {
        this.profileContractId = profileContractId;
    }

    getMessage(messageId: string): Promise<NodeType> {
        console.log(`===== AoScraper getTweet`, messageId);
        return Promise.resolve(undefined);
    }

    async fetchIncomingMessages(count: number): Promise<NodeType[]> {
        console.log("fetching home timeline", this.profileContractId, count);
        const reqBody = {
            query: GQL_TXS_QUERY,
            variables: {
                cursor: "",
                entityId: this.profileContractId,
                limit: count,
                sortOrder: "INGESTED_AT_DESC",
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

        return messageResponse.data.transactions.edges.map((e) => e.node);
    }

    fetchSearchMessages(
        query: string,
        maxTweets: number,
        searchMode: SearchMode,
        cursor: string
    ) {
        return undefined;
    }

    async fetchFollowingTimeline(count: number, param2: any[]) {
        return undefined;
    }

    async getUserMessages(id: string, count: number): Promise<Array<NodeType>> {
        return Promise.resolve(undefined);
    }

    async sendNoteTweet(content: string, tweetId: string) {
        return Promise.resolve(undefined);
    }

    async connect() {
        this.signer = createDataItemSigner(process.env.AO_WALLET);
    }

    async sendAoMessage(content: string, id: string): Promise<string> {
        const messageSent = await message({
            process: process.env.AO_MESSAGE_PROTOCOL_ID,
            tags: [
                { name: "Action", value: "Send-Message" },
                { name: "Message-Id", value: id },
            ],
            signer: this.signer,
            data: content,
        });

        return messageSent;
    }

    async likeTweet(id: string) {}

    async retweet(id: string) {}

    async sendQuoteTweet(quoteContent: string, id: string) {
        return Promise.resolve(undefined);
    }

    async setCookies(cookieStrings: string[]) {}

    async getProfile(username: string): Promise<AoFetchProfileResult> {
        const result = await dryrun({
            process: username,
            data: "1984",
            tags: [{ name: "Action", value: "Info" }],
        });
        const data = JSON.parse(result.Messages[0].Data);

        console.log(`Profile data`, data);
        return data;
    }
}

export interface AoFetchProfileResult {
    Assets: Array<string>;
    Owner: string;
    Collections: Array<string>;
    Profile: AoProfileResult;
}

export interface AoProfileResult {
    Version: string;
    ProfileImage: string;
    UserName: string;
    CoverImage: string;
    Description: string;
    DateUpdated: number;
    DisplayName: string;
    DateCreated: number;
}
