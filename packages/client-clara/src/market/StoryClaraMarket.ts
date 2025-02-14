import { ClaraMarketStory, ClaraProfileStory } from "redstone-clara-sdk";
import { elizaLogger } from "@elizaos/core";
import fs from "fs";
import { ClaraConfig } from "../utils/environment";
import { IClaraMarket } from "./IClaraMarket";
import { parseEther } from "viem";

export class StoryClaraMarket implements IClaraMarket {
    private profile: ClaraProfileStory;
    private market: ClaraMarketStory;
    private wallet: string;

    constructor(private profileId: string, private claraConfig: ClaraConfig) {
        this.market = new ClaraMarketStory(this.claraConfig.CLARA_MARKET_ID);
        this.wallet = this.claraConfig.CLARA_WALLET;
    }

    async init() {
        await this.connectProfile();
    }

    getProfile() {
        return this.profile;
    }
    getMarket() {
        return this.market;
    }
    getWallet(): string {
        return this.wallet;
    }

    async connectProfile(): Promise<void> {
        elizaLogger.info("connecting profile", this.profileId);
        if (fs.existsSync(`../profiles/${this.profileId}`)) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            elizaLogger.info(this.wallet, this.claraConfig.CLARA_MARKET_ID);
            try {
                this.profile = new ClaraProfileStory(
                    this.wallet,
                    this.claraConfig.CLARA_MARKET_ID
                );
            } catch (e) {
                console.log(e);
            }
        } else {
            try {
                this.profile = await this.market.registerAgent(this.wallet, {
                    metadata: JSON.stringify({ description: this.profileId }),
                    topic: "tweet",
                    fee: parseEther("0.000000000001"),
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
