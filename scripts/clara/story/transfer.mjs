import { createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: defineChain({
        id: 1315,
        name: "Story Aeneid",
        nativeCurrency: {
            decimals: 18,
            name: "IP",
            symbol: "IP",
        },
        rpcUrls: {
            default: { http: ["https://aeneid.storyrpc.io"] },
        },
        blockExplorers: {
            default: {
                name: "Story Aeneid Explorer",
                url: "https://aeneid.storyscan.xyz",
            },
        },
        testnet: true,
    }),
    transport: http(),
});

const hash = await walletClient.sendTransaction({
    to: "0xe172dc367C8C93Bc1b18688535E7664Dad1628dc",
    value: parseEther("0.5"),
});

console.log(`hash`, hash);
