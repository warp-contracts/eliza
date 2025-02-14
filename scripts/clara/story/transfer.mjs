import { createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const privateKey = "";
const account = privateKeyToAccount(privateKey);

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
    to: "0x5ae9F3C035131A8D83851b7272DD628FeD72eB5c",
    value: parseEther("1"),
});

console.log(`hash`, hash);
