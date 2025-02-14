import { IAgentRuntime, UUID } from "@elizaos/core";
import { ClientBase } from "../base";

export abstract class ClaraTask {
    protected walletId: string;
    protected agentId: UUID;
    constructor(
        protected client: ClientBase,
        protected runtime: IAgentRuntime
    ) {
        this.walletId = this.client.walletId;
        this.agentId = this.runtime.agentId;
    }
}
