import fs from "node:fs";
import { createDataItemSigner, message } from "@permaweb/aoconnect";

const DEFAULT_CLARA_PROCESS_ID = '86kVM56iOu4P_AfgGGfS9wEDzpO9yb6vaX_tOaDKqMU';
const TOKEN_ID = 'NG-0lVX882MG5nhARrSzyprEK6ejonHpdUmaaMPsHE8';

function getFromEnv(key) {
    const fileContent = fs.readFileSync(".env", "utf8");
    const regex = new RegExp(`^${key}=(.*)$`, 'm');
    const match = fileContent.match(regex);
    if (match) {
        return match[1];
    }
    return null;
}

async function transfer() {
    const wallet = getFromEnv('AO_WALLET').replaceAll("'", '')
    const signer = createDataItemSigner(JSON.parse(wallet));
    const id = await message({
      process: TOKEN_ID,
      tags: [{ name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: DEFAULT_CLARA_PROCESS_ID },
        { name: 'Quantity', value: '1000000000' }],
      signer,
    });
    return `https://www.ao.link/#/message/${id}`;
  }

  transfer().then(console.log).catch(console.error);

