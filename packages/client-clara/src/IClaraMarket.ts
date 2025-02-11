import { ClaraProfile, ClaraProfileStory, ClaraMarket, ClaraMarketStory } from 'redstone-clara-sdk';

export interface IClaraMarket {
    profile: ClaraProfile | ClaraProfileStory;
    market: ClaraMarket | ClaraMarketStory;
    wallet: string;
    init(): Promise<void>;
    connectProfile(): Promise<void>;
}