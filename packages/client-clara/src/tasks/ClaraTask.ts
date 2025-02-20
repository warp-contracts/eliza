import { IAgentRuntime, UUID } from "@elizaos/core";
import { ClaraClientBase } from "../ClaraClientBase";

export abstract class ClaraTask {
    protected walletId: string;
    protected agentId: UUID;
    constructor(
        protected client: ClaraClientBase,
        protected runtime: IAgentRuntime
    ) {
        this.walletId = this.client.walletId;
        this.agentId = this.runtime.agentId;
    }
}
