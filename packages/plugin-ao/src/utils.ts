import {createDataItemSigner} from "@permaweb/aoconnect";

const wallet = () => {
    return createDataItemSigner(JSON.parse(process.env.AO_WALLET));
};

export { wallet };
