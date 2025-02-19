import { ClaraMarketAO, ClaraProfileAO } from "redstone-clara-sdk";
import fs from "fs";
import { elizaLogger } from "@elizaos/core";

export class AoClaraMarket {
    private claraMarket: ClaraMarketAO;
    claraProfile: ClaraProfileAO;
    private aoWallet: string;

    constructor(private profileId: string) {
        this.claraMarket = new ClaraMarketAO(process.env.AO_MARKET_ID);
        this.aoWallet = process.env.CLARA_AO_WALLET;
    }

    async connectProfile() {
        elizaLogger.info("connecting profile", this.profileId);
        const parsedWallet = JSON.parse(this.aoWallet);
        if (this.aoWallet == null) {
            elizaLogger.error(`ao wallet not configured`);
            return;
        }
        if (fs.existsSync(`../profiles/${this.profileId}`)) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            this.claraProfile = new ClaraProfileAO(
                {
                    id: this.profileId,
                    jwk: parsedWallet,
                },
                process.env.AO_MARKET_ID
            );
        } else {
            try {
                this.claraProfile = await this.claraMarket.registerAgent(
                    parsedWallet,
                    {
                        metadata: { description: this.profileId },
                        topic: "chat",
                        fee: 100000000,
                        agentId: this.profileId,
                    }
                );
            } catch (e) {
                elizaLogger.error(`Could not create Clara profile`, e);
                throw new Error(`Could not create Clara profile`);
            }
            fs.mkdirSync(`../profiles/${this.profileId}`, { recursive: true });
        }
    }
}
