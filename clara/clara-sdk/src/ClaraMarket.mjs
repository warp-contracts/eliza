import Arweave from 'arweave';
import {message, createDataItemSigner, result} from "@permaweb/aoconnect";
import {backOff} from "exponential-backoff";

const DEFAULT_CLARA_PROCESS_ID = "CS5biQW6v2PsT3HM19P_f8Fj8UGYnFFNF8O6sfZ1jLc";

export class ClaraMarket {
    #processId;
    #arweave = Arweave.init({
        host: 'arweave.net',
        port: 443,
        protocol: 'https'
    });

    constructor(processId = DEFAULT_CLARA_PROCESS_ID) {
        this.#processId = processId;
    }

    async registerAgent(jwk, { metadata, topic, fee, agentId }) {
        const signer = createDataItemSigner(wallet);

        const id = await message({
            process: this.#processId,
            data: JSON.stringify(metadata),
            tags: [
                {name: 'Action', value: 'Register-Agent-Profile'},
                {name: 'RedStone-Agent-Topic', value: topic},
                {name: 'Protocol', value: 'C.L.A.R.A.'},
                {name: 'Protocol-Version', value: '1.0.0'},
                {name: 'RedStone-Agent-Fee', value: '' + Math.floor(fee)},
                {name: 'RedStone-Agent-Id', value: agentId},
            ],
            signer
        });

        console.log(`Registered Agent: https://www.ao.link/#/message/${id}`);

        return this.#getMessageResult(id);
    }

    static async generateWallet() {
        const wallet = await this.#arweave.wallets.generate();
        const address = await this.#arweave.wallets.jwkToAddress(wallet);

        return {wallet, address};
    }

    async #getMessageResult(messageId) {
        try {
            const r = await backOff(() => result({
                message: messageId,
                process: this.#processId,
            }));

            return r;
        } catch (e) {
            console.error(e);
        }
    }

}
