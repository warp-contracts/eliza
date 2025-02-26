import {
    ClaraProfile,
    ClaraProfileStory,
    ClaraMarket,
    ClaraMarketStory,
} from "redstone-clara-sdk";

export interface IClaraMarket {
    getProfile(): Promise<ClaraProfile | ClaraProfileStory>;
    getMarket(): ClaraMarket | ClaraMarketStory;
    getWallet(): string;
    connectProfile(): Promise<void>;
}
