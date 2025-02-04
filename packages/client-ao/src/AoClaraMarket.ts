import { ClaraMarket, ClaraProfile } from "redstone-clara-sdk";
import { elizaLogger } from "@elizaos/core";
import fs from "fs";

export class AoClaraMarket {
    profile: ClaraProfile;
    private market: ClaraMarket;
    private aoWallet: string;

    constructor(private profileId: string) {
        this.market = new ClaraMarket(process.env.AO_MARKET_ID);
        this.aoWallet = process.env.AO_WALLET;
    }

    async init() {
        await this.connectProfile();
    }

    async connectProfile(): Promise<void> {
        elizaLogger.info("connecting profile", this.profileId);
        const parsedWallet = JSON.parse(this.aoWallet);
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
                    fee: 10000000000,
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
