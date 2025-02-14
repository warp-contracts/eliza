import { ClaraMarket, ClaraProfile } from "redstone-clara-sdk";
import { elizaLogger } from "@elizaos/core";
import fs from "fs";
import { ClaraConfig } from "../utils/environment";
import { IClaraMarket } from "./IClaraMarket";

export class AoClaraMarket implements IClaraMarket {
    private profile: ClaraProfile;
    private market: ClaraMarket;
    private wallet: string;

    constructor(private profileId: string, private claraConfig: ClaraConfig) {
        this.market = new ClaraMarket(this.claraConfig.CLARA_MARKET_ID);
        this.wallet = this.claraConfig.CLARA_WALLET;
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

    async init() {
        await this.connectProfile();
    }

    async connectProfile(): Promise<void> {
        elizaLogger.info("connecting profile", this.profileId);
        const parsedWallet = JSON.parse(this.wallet);
        if (fs.existsSync(`../profiles/${this.profileId}`)) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            this.profile = new ClaraProfile(
                {
                    id: this.profileId,
                    jwk: parsedWallet,
                },
                process.env.AO_MARKET_ID
            );
        } else {
            try {
                this.profile = await this.market.registerAgent(parsedWallet, {
                    metadata: { description: this.profileId },
                    topic: "tweet",
                    fee: 10000000,
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
