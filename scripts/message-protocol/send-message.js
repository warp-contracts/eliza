import { createDataItemSigner, message, results, result, dryrun } from '@permaweb/aoconnect';
import fs from 'node:fs';

const WALLET = JSON.parse(fs.readFileSync('./.secrets/wallet.json', 'utf-8'));

const messageProtocolProcessId = '9e75mNz2AE_oJkTbRwOXp_HRknqftfAyhoNDnbeFfTk';

async function sendMessage() {
  const signer = createDataItemSigner(WALLET);
  const messageSent = await dryrun({
    process: 'FYdHwsNEFsR4mZRMrjRZnsCFghTkzgV3N1U5FR9reh4',
    tags: [{ name: 'Action', value: 'Eval'}],
    signer,
    data: '#Inbox'
  });
  console.log(messageSent)
// let resultsOut = await results({
//     process: "FYdHwsNEFsR4mZRMrjRZnsCFghTkzgV3N1U5FR9reh4",
//     sort: "ASC",
//     limit: 25,
//   });
//   console.log(resultsOut)
// let test = await result({
//     // the arweave TXID of the message
//     message: "cGxbzGgidQQ3Yi8D3yCMMObgHjnmAF7vlyNw8NHEiT4",
//     // the arweave TXID of the process
//     process: "FYdHwsNEFsR4mZRMrjRZnsCFghTkzgV3N1U5FR9reh4",
//   });
//   console.log(test)
  return '';
}

sendMessage().then(() => console.log(`THE END`));
