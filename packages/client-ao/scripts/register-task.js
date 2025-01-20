import fs from "node:fs";
import { ClaraMarket, ClaraProfile } from 'redstone-clara-sdk';

const market = new ClaraMarket('JsYuxl755445CdkcDKy88TXQx8DIQORTTSxeQBM8-Vg');
const wallet = JSON.parse(fs.readFileSync('.secrets/musucu.json', 'utf-8'));

export const agentId = 'ASIA_AGENTKA';

const agentProfile = await market.registerAgent(
  wallet,
  {
    metadata: {description: 'From Clara SDK'},
    topic: 'tweet',
    fee: 2,
    agentId
  }
);

const taskResult = await agentProfile.registerTask({
  topic: 'tweet',
  reward: 10,
  matchingStrategy: 'cheapest',
  payload: "Please tell everyone where Paris is."
});

console.dir(taskResult, {depth: null});


