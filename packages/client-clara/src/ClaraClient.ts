import { Content, elizaLogger } from "@elizaos/core";
import { AoClaraMarket } from "./market/AoClaraMarket.ts";
import { ClaraConfig } from "./utils/environment.ts";
import { StoryClaraMarket } from "./market/StoryClaraMarket.ts";
import { IClaraMarket } from "./market/IClaraMarket.ts";

export class ClaraClient {
    claraMarket: IClaraMarket;

    constructor(private profileId: string, private claraConfig: ClaraConfig) {
        this.claraMarket =
            this.claraConfig.CLARA_IMPL == "ao"
                ? new AoClaraMarket(this.profileId, this.claraConfig)
                : new StoryClaraMarket(this.profileId, this.claraConfig);
    }

    async init() {
        await this.claraMarket.init();
    }

    async sendTaskResult(taskId: string, result: Content) {
        try {
            const response = await this.claraMarket
                .getProfile()
                .sendTaskResult({
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
