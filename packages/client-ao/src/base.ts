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
import { SearchMode } from "agent-twitter-client";
import { EventEmitter } from "events";
import { AoConfig } from "./environment.ts";
import { AoClient, AoFetchProfileResult } from "./AoClient.ts";
import { NodeType } from "./ao_types.ts";


interface AoProfile extends AoFetchProfileResult {
    contractId: string;
}

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

    profile: AoProfile | null;

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
        console.log(`===== Base constructor`);
        this.runtime = runtime;
        this.aoConfig = aoConfig;
        const profileContractId = aoConfig.AO_PROFILE_CONTRACT;
        if (ClientBase._aoClients[profileContractId]) {
            this.aoClient = ClientBase._aoClients[profileContractId];
        } else {
            this.aoClient = new AoClient(profileContractId);
            ClientBase._aoClients[profileContractId] = this.aoClient;
        }
        this.aoClient.connect();

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

    async init() {
        const profileContractId = this.aoConfig.AO_PROFILE_CONTRACT;

        const cachedCookies = await this.getCachedCookies(profileContractId);

        if (cachedCookies) {
            elizaLogger.info("Using cached cookies");
            await this.setCookiesFromArray(cachedCookies);
        }

        // Initialize Twitter profile
        this.profile = await this.fetchProfile(profileContractId);

        if (this.profile) {
            elizaLogger.log("AO contract ID:", this.profile.contractId);
            elizaLogger.log(
                "AO profile loaded:",
                JSON.stringify(this.profile, null, 10)
            );
            // Store profile info for use in responses
            this.runtime.character.twitterProfile = {
                id: this.profile.contractId,
                username: this.profile.Profile.UserName,
                screenName: this.profile.Profile.DisplayName,
                bio: this.profile.Profile.Description,
            };
        } else {
            throw new Error("Failed to load profile");
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

    async fetchSearchMessages(
        query: string,
        maxMessages: number,
        searchMode: SearchMode,
        cursor?: string
    ): Promise<any> {
        try {
            // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
            // if we dont get a response in 5 seconds, something is wrong
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve({ messages: [] }), 15000)
            );

            try {
                const result = await this.requestQueue.add(
                    async () =>
                        await Promise.race([
                            this.aoClient.fetchSearchMessages(
                                query,
                                maxMessages,
                                searchMode,
                                cursor
                            ),
                            timeoutPromise,
                        ])
                );
                return result ?? { messages: [] };
            } catch (error) {
                elizaLogger.error("Error fetching search messages:", error);
                return { messages: [] };
            }
        } catch (error) {
            elizaLogger.error("Error fetching search messages:", error);
            return { messages: [] };
        }
    }

    private async populateTimeline() {
        elizaLogger.debug("populating timeline...");

        const cachedTimeline = await this.getCachedTimeline();
        console.log(`-- cachedTimeline`, cachedTimeline);

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
                        message.owner.address === this.profile.contractId
                            ? this.runtime.agentId
                            : stringToUuid(message.owner.address);

                    if (message.owner.address === this.profile.contractId) {
                        await this.runtime.ensureConnection(
                            this.runtime.agentId,
                            roomId,
                            this.profile.Profile.UserName,
                            this.profile.Profile.UserName,
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
                        createdAt: message.timestamp * 1000,
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
            this.profile.contractId,
            this.runtime.character.name,
            "AoTheComputer"
        );

        // Save the new messages as memories
        for (const message of messagesToSave) {
            elizaLogger.log("Saving Message", message.id);

            const roomId = stringToUuid(
                message.id + "-" + this.runtime.agentId
            );
            const userId =
                message.owner.address === this.profile.contractId
                    ? this.runtime.agentId
                    : stringToUuid(message.owner.address);

            if (message.owner.address === this.profile.contractId) {
                await this.runtime.ensureConnection(
                    this.runtime.agentId,
                    roomId,
                    this.profile.Profile.UserName,
                    this.profile.Profile.DisplayName,
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
                createdAt: message.timestamp * 1000,
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
                `ao/${this.profile.contractId}/latest_checked_message_ts`
            );

        if (latestCheckedMessageTs) {
            this.lastCheckedMessageTs = latestCheckedMessageTs;
        }
    }

    async cacheLatestCheckedMessageTimestamp() {
        if (this.lastCheckedMessageTs) {
            await this.runtime.cacheManager.set(
                `ao/${this.profile.contractId}/latest_checked_message_ts`,
                this.lastCheckedMessageTs
            );
        }
    }

    async getCachedTimeline(): Promise<NodeType[] | undefined> {
        return await this.runtime.cacheManager.get<NodeType[]>(
            `ao/${this.profile.contractId}/timeline`
        );
    }

    async cacheTimeline(timeline: NodeType[]) {
        await this.runtime.cacheManager.set(
            `ao/${this.profile.contractId}/timeline`,
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

    async getCachedProfile(contractId: string) {
        return await this.runtime.cacheManager.get<AoProfile>(
            `ao/${contractId}/profile`
        );
    }

    async cacheProfile(profile: AoProfile) {
        await this.runtime.cacheManager.set(
            `ao/${profile.contractId}/profile`,
            profile
        );
    }

    async fetchProfile(profileContractId: string): Promise<AoProfile> {
        const cached = await this.getCachedProfile(profileContractId);

        if (cached) return cached;

        try {
            const profile = await this.requestQueue.add(async () => {
                const profileResult =
                    await this.aoClient.getProfile(profileContractId);
                return {
                    ...profileResult,
                    contractId: profileContractId,
                };
            });

            this.cacheProfile(profile);
            return profile;
        } catch (error) {
            console.error("Error fetching AO profile:", error);

            return undefined;
        }
    }
}
