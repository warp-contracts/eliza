import {
    elizaLogger,
    getEmbeddingZeroVector,
    IAgentRuntime,
    Memory,
    State,
} from "@elizaos/core";
import { EventEmitter } from "events";
import { ClaraConfig } from "./utils/environment.ts";
import { ClaraClient } from "./ClaraClient.ts";

export class ClientBase extends EventEmitter {
    static _claraClients: { [accountIdentifier: string]: ClaraClient } = {};
    claraClient: ClaraClient;
    runtime: IAgentRuntime;
    claraConfig: ClaraConfig;
    directions: string;
    lastCheckedMessage: number | null = null;
    profileId: string;
    walletId: string;
    callback: (self: ClientBase) => any = null;

    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

    constructor(runtime: IAgentRuntime, claraConfig: ClaraConfig) {
        super();
        this.runtime = runtime;
        this.claraConfig = claraConfig;
        this.profileId = `${this.runtime.agentId}_${claraConfig.CLARA_USERNAME}`;
        this.walletId = claraConfig.CLARA_WALLET_ID;
        if (ClientBase._claraClients[this.profileId]) {
            this.claraClient = ClientBase._claraClients[this.profileId];
        } else {
            this.claraClient = new ClaraClient(
                this.profileId,
                this.claraConfig
            );
            ClientBase._claraClients[this.profileId] = this.claraClient;
        }

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
    }

    async init() {
        await this.claraClient.init();
        if (this.profileId) {
            elizaLogger.log("Clara profile ID:", this.profileId);
        } else {
            throw new Error("Failed to load profile id");
        }

        await this.loadLatestCheckedMessage(this.claraConfig.CLARA_IMPL);
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
                twitterClient: this.claraClient,
            });
        }
    }

    async loadLatestCheckedMessage(claraImpl: string): Promise<void> {
        const latestCheckedMessage =
            await this.runtime.cacheManager.get<number>(
                `${claraImpl}/${this.profileId}/latest_checked_message`
            );

        if (latestCheckedMessage) {
            this.lastCheckedMessage = latestCheckedMessage;
        }
    }

    async cacheLatestCheckedMessage(claraImpl: string) {
        if (this.lastCheckedMessage) {
            await this.runtime.cacheManager.set(
                `${claraImpl}/${this.profileId}/latest_checked_message`,
                this.lastCheckedMessage
            );
        }
    }
}
