import fs from "node:fs";
import { ClaraProfile } from "redstone-clara-sdk";

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
    const wallet = getFromEnv('CLARA_AO_WALLET').replaceAll("'", '');
    const marketId = getFromEnv('CLARA_AO_MARKET_ID').replaceAll("'", '');
    const claraProfile = new ClaraProfile(
        {
            id: 'agent_id',
            jwk: JSON.parse(wallet),
        },
       marketId
    );
    return await claraProfile.withdraw();
  }

  withdraw().then(console.log).catch(console.error);

