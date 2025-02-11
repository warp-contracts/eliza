import { createDataItemSigner } from "@permaweb/aoconnect";
import { AoSigner, NodeType } from "./ao_types.ts";
import { Content, elizaLogger } from "@elizaos/core";
import { AoClaraMarket } from "./AoClaraMarket.ts";
import { ClaraConfig } from "./environment.ts";
import { StoryClaraMarket } from "./StoryClaraMarket.ts";
import { IClaraMarket } from "./IClaraMarket.ts";

export class ClaraClient {
    profileId: string;
    walletId: string;
    signer: AoSigner;
    claraMarket: IClaraMarket;
    claraConfig: ClaraConfig;

    constructor(profileId: string, walletId: string, claraConfig: ClaraConfig) {
        this.profileId = profileId;
        this.walletId = walletId;
        this.claraConfig = claraConfig;
        this.claraMarket =
            this.claraConfig.CLARA_IMPL == "ao"
                ? new AoClaraMarket(this.profileId, this.claraConfig)
                : new StoryClaraMarket(this.profileId, this.claraConfig);
    }

    async init() {
        // this.signer = createDataItemSigner(JSON.parse(process.env.AO_WALLET));
        await this.claraMarket.init();
    }

    async sendTaskResult(taskId: string, result: Content) {
        try {
            const response = await this.claraMarket.profile.sendTaskResult({
                taskId,
                result: JSON.stringify(result),
            });
            elizaLogger.info(
                `Task result for id: ${taskId} sent`,
                JSON.stringify(response)
            );
            return response;
        } catch (e) {
            console.log(e);
            elizaLogger.error(
                `Could not send task result for task: ${taskId}.`,
                e
            );
            return false;
        }
    }
}
