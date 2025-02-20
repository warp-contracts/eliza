import {
    ClaraProfile,
    ClaraProfileStory,
    ClaraMarket,
    ClaraMarketStory,
} from "redstone-clara-sdk";

export interface IClaraMarket {
    getProfile(): ClaraProfile | ClaraProfileStory;
    getMarket(): ClaraMarket | ClaraMarketStory;
    getWallet(): string;
    init(): Promise<void>;
    connectProfile(): Promise<void>;
}
