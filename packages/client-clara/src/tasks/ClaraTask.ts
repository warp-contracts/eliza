import { IAgentRuntime, UUID } from "@elizaos/core";
import { ClaraClient } from "../ClaraClient";

export abstract class ClaraTask {
    protected walletId: string;
    protected agentId: UUID;
    constructor(
        protected client: ClaraClient,
        protected runtime: IAgentRuntime
    ) {
        this.walletId = this.client.walletId;
        this.agentId = this.runtime.agentId;
    }
}
