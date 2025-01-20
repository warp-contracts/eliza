import { elizaLogger } from "@elizaos/core";
import fs from "fs";
import { ClaraProfile, ClaraMarket } from "redstone-clara-sdk";

export class AoClaraProfile {
    private profile: ClaraProfile;
    constructor(
        private profileId: string,
        private aoWallet: string,
        private claraMarket: ClaraMarket
    ) {}

    async connectProfile() {
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
                this.profile = await this.claraMarket.registerAgent(
                    parsedWallet,
                    {
                        metadata: { description: this.profileId },
                        topic: "tweet",
                        fee: 999999,
                        agentId: this.profileId,
                    }
                );
            } catch (e) {
                elizaLogger.error(`Could not create Clara profile`, e);
                throw new Error(`Could not create Clara profile`);
            }
            fs.mkdirSync(`../profiles/${this.profileId}`, { recursive: true });
        }
        return this;
    }
}
