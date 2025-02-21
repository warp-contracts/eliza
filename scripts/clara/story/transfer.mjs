import { createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import { storyAeneid } from "redstone-clara-sdk";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: storyAeneid, // can be replaced with storyMainnet
    transport: http(),
});

const hash = await walletClient.sendTransaction({
    to: "0xe172dc367C8C93Bc1b18688535E7664Dad1628dc",
    value: parseEther("0.5"),
});

console.log(`hash`, hash);
