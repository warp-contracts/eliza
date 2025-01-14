import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import fs from 'node:fs';
import { backOff } from 'exponential-backoff';

const AOS_MODULE_SQLITE = 'CJ-iZL7RKNA43UZr3l6J5M8JegMP9RldoCoVge_vRuI';
const AO_TESTNET_SU = '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';

const { spawn, message } = connect();
const WALLET = JSON.parse(fs.readFileSync('./.secrets/wallet.json', 'utf-8'));

async function doSpawn() {
  const CODE = fs.readFileSync(`./lua/protocol.lua`, 'utf-8');
  const signer = createDataItemSigner(WALLET);

  console.info(`Spawning AOS Message Protocol Lua process`);
  const processId = await spawn({
    module: AOS_MODULE_SQLITE,
    scheduler: AO_TESTNET_SU,
    signer,
    data: '1984',
  });

  try {
    const r = await backOff(() =>
      message({
        process: processId,
        data: CODE,
        tags: [{ name: 'Action', value: 'Eval' }],
        signer,
      })
    );
    console.log(`Successfully sent 'eval' action for process '${processId}'.`);
    console.log(`https://www.ao.link/#/message/${r}`);
  } catch (e) {
    console.error(e);
  }

  return processId;
}

doSpawn().then((processId) => console.log(`https://www.ao.link/#/entity/${processId}`));
