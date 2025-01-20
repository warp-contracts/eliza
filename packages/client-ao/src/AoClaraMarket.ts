import { ClaraMarket, ClaraProfile } from "redstone-clara-sdk";
import { AoClaraProfile } from "./AoClaraProfile";

export class AoClaraMarket {
    private claraMarket: ClaraMarket;
    private claraProfile: ClaraProfile;
    private aoWallet: string;

    constructor(private profileId: string) {
        this.claraMarket = new ClaraMarket(process.env.AO_MARKET_ID);
        this.aoWallet = process.env.AO_WALLET;
    }

    async init() {
        const claraProfileInstance = new AoClaraProfile(
            this.profileId,
            this.aoWallet,
            this
        );
        this.claraProfile = await claraProfileInstance.connectProfile();
    }
}
