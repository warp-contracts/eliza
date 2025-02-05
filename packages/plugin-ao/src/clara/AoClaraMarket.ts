import { ClaraMarket, ClaraProfile } from "redstone-clara-sdk";
import fs from "fs";
import { elizaLogger } from "@elizaos/core";

export class AoClaraMarket {
    private claraMarket: ClaraMarket;
    claraProfile: ClaraProfile;
    private aoWallet: string;

    constructor(private profileId: string) {
        this.claraMarket = new ClaraMarket(process.env.AO_MARKET_ID);
        this.aoWallet = process.env.AO_WALLET;
    }

    async connectProfile() {
        elizaLogger.info("connecting profile", this.profileId);
        const parsedWallet = JSON.parse(this.aoWallet);
        if (fs.existsSync(`../profiles/${this.profileId}`)) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            this.claraProfile = new ClaraProfile(
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
            console.log(this.claraProfile);
        }
    }
}
