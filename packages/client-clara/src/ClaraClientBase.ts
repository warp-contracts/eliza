import {
    elizaLogger,
    getEmbeddingZeroVector,
    IAgentRuntime,
    Memory,
    State,
} from "@elizaos/core";
import { EventEmitter } from "events";
import { ClaraConfig } from "./utils/environment.ts";
import { IClaraMarket } from "./market/IClaraMarket.ts";
import { AoClaraMarket } from "./market/AoClaraMarket.ts";
import { StoryClaraMarket } from "./market/StoryClaraMarket.ts";
import { ClaraClient } from "./ClaraClient.ts";
import { ClaraTaskType } from "./utils/claraTypes.ts";

export class ClaraClientBase extends EventEmitter {
    static _claraClients: { [accountIdentifier: string]: ClaraClient } = {};
    claraClient: ClaraClient;
    claraMarket: IClaraMarket;
    runtime: IAgentRuntime;
    claraConfig: ClaraConfig;
    directions: string;
    lastCheckedMessage: number | null = null;
    profileId: string;
    walletId: string;
    callback: (self: ClaraClientBase) => any = null;

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
        if (ClaraClientBase._claraClients[this.profileId]) {
            this.claraClient = ClaraClientBase._claraClients[this.profileId];
        } else {
            this.claraClient = new ClaraClient(
                this.profileId,
                this.claraConfig
            );
            ClaraClientBase._claraClients[this.profileId] = this.claraClient;
        }

        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
        this.claraMarket =
            this.claraConfig.CLARA_IMPL == "ao"
                ? new AoClaraMarket(this.profileId, this.claraConfig)
                : new StoryClaraMarket(this.profileId, this.claraConfig);
    }

    async init() {
        await this.claraMarket.init();
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

    updateLastCheckedMessage(message: ClaraTaskType) {
        switch (this.claraConfig.CLARA_IMPL) {
            case "ao":
                this.lastCheckedMessage = message.timestamp;
                break;
            case "story":
                this.lastCheckedMessage = Number(message.blockNumber);
                break;
            default:
                throw new Error(
                    `Unknown Clara impl: ${this.claraConfig.CLARA_IMPL}`
                );
        }
    }
}
