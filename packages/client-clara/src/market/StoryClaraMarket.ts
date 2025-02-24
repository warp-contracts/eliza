import {
    ClaraMarketStory,
    ClaraProfileStory,
    storyAeneid,
    storyMainnet,
} from "redstone-clara-sdk";
import { elizaLogger } from "@elizaos/core";
import fs from "fs";
import { ClaraConfig } from "../utils/environment";
import { IClaraMarket } from "./IClaraMarket";
import { Chain, parseEther, PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export class StoryClaraMarket implements IClaraMarket {
    private profile: ClaraProfileStory;
    private market: ClaraMarketStory;
    private account: PrivateKeyAccount;
    private chain: Chain;

    constructor(private profileId: string, private claraConfig: ClaraConfig) {
        this.chain =
            process.env.CLARA_STORY_CHAIN == "mainnet"
                ? storyMainnet
                : storyAeneid;
        this.market = new ClaraMarketStory(
            this.claraConfig.CLARA_MARKET_CONTRACT_ADDRESS,
            this.chain
        );
        this.account = privateKeyToAccount(
            this.claraConfig.CLARA_PRIVATE_KEY as `0x${string}`
        );
    }

    async init() {
        await this.connectProfile();
    }

    getProfile() {
        if (!this.profile) this.connectProfile();
        return this.profile;
    }
    getMarket() {
        return this.market;
    }
    getWallet(): string {
        return JSON.stringify(this.account);
    }

    async connectProfile(): Promise<void> {
        elizaLogger.info("connecting profile", this.profileId);
        if (fs.existsSync(`../profiles/${this.profileId}`)) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            try {
                this.profile = new ClaraProfileStory(
                    this.account,
                    this.claraConfig.CLARA_MARKET_CONTRACT_ADDRESS,
                    storyAeneid
                );
            } catch (e) {
                console.log(e);
            }
        } else {
            try {
                this.profile = await this.market.registerAgent(this.account, {
                    metadata: JSON.stringify({ description: this.profileId }),
                    topic: "tweet",
                    fee: parseEther(this.claraConfig.CLARA_FEE),
                    agentId: this.profileId,
                });
            } catch (e) {
                elizaLogger.error(`Could not create Clara profile`, e);
                throw new Error(e);
            }
            fs.mkdirSync(`../profiles/${this.profileId}`, { recursive: true });
        }
    }
}
