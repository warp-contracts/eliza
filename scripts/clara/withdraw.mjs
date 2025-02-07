import fs from "node:fs";
import { createDataItemSigner } from "@permaweb/aoconnect";

const DEFAULT_CLARA_PROCESS_ID = '86kVM56iOu4P_AfgGGfS9wEDzpO9yb6vaX_tOaDKqMU';

function getFromEnv(key) {
    const fileContent = fs.readFileSync(".env", "utf8");
    const regex = new RegExp(`^${key}=(.*)$`, 'm');
    const match = fileContent.match(regex);
    if (match) {
        return match[1];
    }
    return null;
}
async function withdraw() {
    const wallet = getFromEnv('AO_WALLET');
    const signer = createDataItemSigner(JSON.parse(wallet));
    const processId = DEFAULT_CLARA_PROCESS_ID;
    const id = await message({
      process: processId,
      tags: [{ name: 'Action', value: 'Claim-Reward-All' }],
      signer,
    });
    return `https://www.ao.link/#/message/${id}`;
  }

  withdraw().then(console.log).catch(console.error);

