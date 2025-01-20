import {
    Content,
    elizaLogger,
    getEmbeddingZeroVector,
    IAgentRuntime,
    IImageDescriptionService,
    Memory,
    State,
    stringToUuid,
    UUID,
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
        this.aoClient.connect();

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

    async init() {
        const cachedCookies = await this.getCachedCookies(this.profileId);

        if (cachedCookies) {
            elizaLogger.info("Using cached cookies");
            await this.setCookiesFromArray(cachedCookies);
        }

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
        await this.populateTimeline();
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

    private async populateTimeline() {
        elizaLogger.debug("populating timeline...");

        const cachedTimeline = await this.getCachedTimeline();

        // Check if the cache file exists
        if (cachedTimeline) {
            // Read the cached search results from the file

            // Get the existing memories from the database
            const existingMemories =
                await this.runtime.messageManager.getMemoriesByRoomIds({
                    roomIds: cachedTimeline.map((message) =>
                        stringToUuid(message.id + "-" + this.runtime.agentId)
                    ),
                });

            // Create a Set to store the IDs of existing memories
            const existingMemoryIds = new Set(
                existingMemories.map((memory) => memory.id.toString())
            );

            // Check if any of the cached messages exist in the existing memories
            const someCachedMessagesExist = cachedTimeline.some((message) =>
                existingMemoryIds.has(
                    stringToUuid(message.id + "-" + this.runtime.agentId)
                )
            );

            if (someCachedMessagesExist) {
                // Filter out the cached messages that already exist in the database
                const messagesToSave = cachedTimeline.filter(
                    (message) =>
                        !existingMemoryIds.has(
                            stringToUuid(
                                message.id + "-" + this.runtime.agentId
                            )
                        )
                );

                console.log({
                    processingMessages: messagesToSave
                        .map((message) => message.id)
                        .join(","),
                });

                // Save the missing messages as memories
                for (const message of messagesToSave) {
                    elizaLogger.log("Saving Message", message.id);

                    const roomId = stringToUuid(
                        message.id + "-" + this.runtime.agentId
                    );

                    const userId =
                        message.owner.address === this.walletId
                            ? this.runtime.agentId
                            : stringToUuid(message.owner.address);

                    if (message.owner.address === this.walletId) {
                        await this.runtime.ensureConnection(
                            this.runtime.agentId,
                            roomId,
                            this.profileId,
                            this.aoConfig.AO_USERNAME,
                            "AoTheComputer"
                        );
                    } else {
                        await this.runtime.ensureConnection(
                            userId,
                            roomId,
                            message.owner.address,
                            message.owner.address,
                            "AoTheComputer"
                        );
                    }

                    const content = {
                        text: message.data.value,
                        url: message.url,
                        source: "AoTheComputer",
                    } as Content;

                    elizaLogger.log("Creating memory for message", message.id);

                    // check if it already exists
                    const memory =
                        await this.runtime.messageManager.getMemoryById(
                            stringToUuid(
                                message.id + "-" + this.runtime.agentId
                            )
                        );

                    if (memory) {
                        elizaLogger.log(
                            "Memory already exists, skipping timeline population"
                        );
                        break;
                    }

                    await this.runtime.messageManager.createMemory({
                        id: stringToUuid(
                            message.id + "-" + this.runtime.agentId
                        ),
                        userId,
                        content: content,
                        agentId: this.runtime.agentId,
                        roomId,
                        embedding: getEmbeddingZeroVector(),
                        createdAt: message.ingested_at * 1000,
                    });

                    await this.cacheMessage(message);
                }

                elizaLogger.log(
                    `Populated ${messagesToSave.length} missing messages from the cache.`
                );
                return;
            }
        }

        const timeline = await this.fetchIncomingMessages(
            cachedTimeline ? 10 : 50
        );

        // Combine the timeline messages and mentions/interactions

        // Create a Set to store unique message IDs
        const messageIdsToCheck = new Set<string>();
        const roomIds = new Set<UUID>();

        // Add message IDs to the Set
        for (const message of timeline) {
            messageIdsToCheck.add(message.id);
            roomIds.add(stringToUuid(message.id + "-" + this.runtime.agentId));
        }

        // Check the existing memories in the database
        const existingMemories =
            await this.runtime.messageManager.getMemoriesByRoomIds({
                roomIds: Array.from(roomIds),
            });

        // Create a Set to store the existing memory IDs
        const existingMemoryIds = new Set<UUID>(
            existingMemories.map((memory) => memory.id)
        );

        // Filter out the messages that already exist in the database
        const messagesToSave = timeline.filter(
            (message) =>
                !existingMemoryIds.has(
                    stringToUuid(message.id + "-" + this.runtime.agentId)
                )
        );

        elizaLogger.debug({
            processingMessages: messagesToSave
                .map((message) => message.id)
                .join(","),
        });

        await this.runtime.ensureUserExists(
            this.runtime.agentId,
            this.profileId,
            this.aoConfig.AO_USERNAME,
            "AoTheComputer"
        );

        // Save the new messages as memories
        for (const message of messagesToSave) {
            elizaLogger.log("Saving Message", message.id);

            const roomId = stringToUuid(
                message.id + "-" + this.runtime.agentId
            );
            const userId =
                message.owner.address === this.walletId
                    ? this.runtime.agentId
                    : stringToUuid(message.owner.address);

            if (message.owner.address === this.walletId) {
                await this.runtime.ensureConnection(
                    this.runtime.agentId,
                    roomId,
                    this.profileId,
                    this.aoConfig.AO_USERNAME,
                    "AoTheComputer"
                );
            } else {
                await this.runtime.ensureConnection(
                    userId,
                    roomId,
                    message.owner.address,
                    message.owner.address,
                    "AoTheComputer"
                );
            }

            const content = {
                text: message.data.value,
                url: message.url,
                source: "AoTheComputer",
            } as Content;

            await this.runtime.messageManager.createMemory({
                id: stringToUuid(message.id + "-" + this.runtime.agentId),
                userId,
                content: content,
                agentId: this.runtime.agentId,
                roomId,
                embedding: getEmbeddingZeroVector(),
                createdAt: message.ingested_at * 1000,
            });

            await this.cacheMessage(message);
        }

        // Cache
        await this.cacheTimeline(timeline);
    }

    async setCookiesFromArray(cookiesArray: any[]) {
        const cookieStrings = cookiesArray.map(
            (cookie) =>
                `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
                    cookie.secure ? "Secure" : ""
                }; ${cookie.httpOnly ? "HttpOnly" : ""}; SameSite=${
                    cookie.sameSite || "Lax"
                }`
        );
        await this.aoClient.setCookies(cookieStrings);
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

    async getCachedTimeline(): Promise<NodeType[] | undefined> {
        return await this.runtime.cacheManager.get<NodeType[]>(
            `ao/${this.profileId}/timeline`
        );
    }

    async cacheTimeline(timeline: NodeType[]) {
        await this.runtime.cacheManager.set(
            `ao/${this.profileId}/timeline`,
            timeline,
            { expires: Date.now() + 10 * 1000 }
        );
    }

    async getCachedCookies(username: string) {
        return await this.runtime.cacheManager.get<any[]>(
            `ao/${username}/cookies`
        );
    }

    async cacheCookies(username: string, cookies: any[]) {
        await this.runtime.cacheManager.set(`ao/${username}/cookies`, cookies);
    }
}
