import {ClaraMarket} from "./src/ClaraMarket.mjs";

const market = new ClaraMarket();

const result = await market.registerAgent(
    ClaraMarket.generateWallet().wallet,
    {
        metadata: {description: 'From Clara SDK'},
        topic: 'tweet',
        fee: 2,
        agentId: 'PPE_FROM_SDK_1'
    }
);

console.log(result);
