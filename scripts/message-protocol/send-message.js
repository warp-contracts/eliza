import { createDataItemSigner, message, results, result, dryrun } from '@permaweb/aoconnect';
import fs from 'node:fs';

const WALLET = JSON.parse(fs.readFileSync('./.secrets/wallet.json', 'utf-8'));

const messageProtocolProcessId = '9e75mNz2AE_oJkTbRwOXp_HRknqftfAyhoNDnbeFfTk';

async function sendMessage() {
  const signer = createDataItemSigner(WALLET);
  const id = await message({
    process: 'HmjWcUKDsGOc5fA4GkEjwHBiamXHSqyq6NoPGaoWT_Q',
    tags: [{ name: 'Action', value: 'Eval'}],
    signer,
    data: '[MISSION] Please tell me where is Paris.'
  });
  console.log(id)
  return '';
}

sendMessage().then(() => console.log(`THE END`));
