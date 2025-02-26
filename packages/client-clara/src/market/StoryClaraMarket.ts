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
        this.market = new ClaraMarketStory(this.chain);
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
        elizaLogger.info("Connecting profile", this.profileId);
        this.profile = new ClaraProfileStory(this.account, storyAeneid);
        const agentData = await this.profile.agentData();
        if (agentData.exists) {
            elizaLogger.info(
                `Agent already registered, connecting`,
                this.profileId
            );
            try {
                const oldFee = (await this.profile.agentData()).fee;
                const newFee = parseEther(this.claraConfig.CLARA_FEE);
                if (oldFee != newFee) {
                    elizaLogger.debug(
                        `Clara agent's fee has changed, updating. Old fee: ${oldFee}, new fee: ${newFee}.`
                    );
                    await this.profile.updateFee(newFee);
                    elizaLogger.debug(`Fee updated correctly.`);
                }
            } catch (e) {
                console.log(e);
            }
        } else {
            try {
                await this.market.registerAgent(this.account, {
                    metadata: JSON.stringify({ description: this.profileId }),
                    topic: "tweet",
                    fee: parseEther(this.claraConfig.CLARA_FEE),
                    agentId: this.profileId,
                });
            } catch (e) {
                elizaLogger.error(`Could not create Clara profile`, e);
                throw new Error(e);
            }
        }
    }
}
