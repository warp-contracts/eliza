import {
    elizaLogger,
    getEmbeddingZeroVector,
    IAgentRuntime,
    IImageDescriptionService,
    Memory,
    State,
} from "@elizaos/core";
import { EventEmitter } from "events";
import { AoConfig } from "./environment.ts";
import { AoClient } from "./AoClient.ts";
import { NodeType } from "./ao_types.ts";

class RequestQueue {
    private queue: (() => Promise<any>)[] = [];
    private processing: boolean = false;

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;
            try {
                await request();
            } catch (error) {
                console.error("Error processing request:", error);
                this.queue.unshift(request);
                await this.exponentialBackoff(this.queue.length);
            }
            await this.randomDelay();
        }

        this.processing = false;
    }

    private async exponentialBackoff(retryCount: number): Promise<void> {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

export class ClientBase extends EventEmitter {
    static _aoClients: { [accountIdentifier: string]: AoClient } = {};
    aoClient: AoClient;
    runtime: IAgentRuntime;
    aoConfig: AoConfig;
    directions: string;
    lastCheckedMessageTs: number | null = null;
    imageDescriptionService: IImageDescriptionService;
    temperature: number = 0.5;
    requestQueue: RequestQueue = new RequestQueue();
    profileId: string;
    walletId: string;

    async cacheMessage(message: NodeType): Promise<void> {
        if (!message) {
            console.warn("Message is undefined, skipping cache");
            return;
        }

        this.runtime.cacheManager.set(`ao/messages/${message.id}`, message);
    }

    async getCachedMessage(messageId: string): Promise<NodeType | undefined> {
        const cached = await this.runtime.cacheManager.get<NodeType>(
            `ao/messages/${messageId}`
        );

        return cached;
    }

    async getMessage(messageId: string): Promise<NodeType> {
        const cachedMessage = await this.getCachedMessage(messageId);

        if (cachedMessage) {
            return cachedMessage;
        }

        const message = await this.requestQueue.add(() =>
            this.aoClient.getMessage(messageId)
        );

        await this.cacheMessage(message);
        return message;
    }

    callback: (self: ClientBase) => any = null;

    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

    constructor(runtime: IAgentRuntime, aoConfig: AoConfig) {
        super();
        this.runtime = runtime;
        this.aoConfig = aoConfig;
        this.profileId = this.runtime.agentId + "_" + aoConfig.AO_USERNAME;
        this.walletId = aoConfig.AO_WALLET_ID;
        if (ClientBase._aoClients[this.profileId]) {
            this.aoClient = ClientBase._aoClients[this.profileId];
        } else {
            this.aoClient = new AoClient(this.profileId, this.walletId);
            ClientBase._aoClients[this.profileId] = this.aoClient;
        }

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

    async init() {
        await this.aoClient.init();

        if (this.profileId) {
            elizaLogger.log("AO profile ID:", this.profileId);
            // Store profile info for use in responses
            this.runtime.character.twitterProfile = {
                id: this.profileId,
                username: this.runtime.agentId,
                screenName: this.aoConfig.AO_USERNAME,
                bio: this.profileId,
            };
        } else {
            throw new Error("Failed to load profile id");
        }

        await this.loadLatestCheckedMessage();
    }

    async fetchIncomingMessages(count: number): Promise<NodeType[]> {
        elizaLogger.debug("fetching home timeline");
        const incomingMessages =
            await this.aoClient.fetchIncomingMessages(count);

        elizaLogger.debug(incomingMessages, { depth: Infinity });
        return incomingMessages;
    }

    async fetchTimelineForActions(count: number): Promise<NodeType[]> {
        elizaLogger.debug("fetching timeline for actions");
        return await this.aoClient.fetchIncomingMessages(count);
    }


    async saveRequestMessage(message: Memory, state: State) {
        if (message.content.text) {
            const recentMessage = await this.runtime.messageManager.getMemories(
                {
                    roomId: message.roomId,
                    count: 1,
                    unique: false,
                }
            );

            if (
                recentMessage.length > 0 &&
                recentMessage[0].content === message.content
            ) {
                elizaLogger.debug("Message already saved", recentMessage[0].id);
            } else {
                await this.runtime.messageManager.createMemory({
                    ...message,
                    embedding: getEmbeddingZeroVector(),
                });
            }

            await this.runtime.evaluate(message, {
                ...state,
                twitterClient: this.aoClient,
            });
        }
    }

    async loadLatestCheckedMessage(): Promise<void> {
        const latestCheckedMessageTs =
            await this.runtime.cacheManager.get<number>(
                `ao/${this.profileId}/latest_checked_message_ts`
            );

        if (latestCheckedMessageTs) {
            this.lastCheckedMessageTs = latestCheckedMessageTs;
        }
    }

    async cacheLatestCheckedMessageTimestamp() {
        if (this.lastCheckedMessageTs) {
            await this.runtime.cacheManager.set(
                `ao/${this.profileId}/latest_checked_message_ts`,
                this.lastCheckedMessageTs
            );
        }
    }
}
