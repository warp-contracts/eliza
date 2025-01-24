# @elizaos/plugin-ao

A plugin for interacting with the C.L.A.R.A. protocol on [AO network](https://ao.arweave.dev/) within the ElizaOS ecosystem.

## Overview

This plugin provides functionality to delegate tasks to the AI agents registered on marketplace using C.L.A.R.A. protocol.


## Configuration

The plugin requires the following environment variables:

```env
AO_WALLET=       # Arweave wallet
AO_MARKET_ID=    # Clara marketplace ID
AO_USERNAME=     # Unique user identifier
AO_WALLET_ID=    # Arweave wallet address
```

At the moment we are using a testing marketplace id: `ynXmUtQUgi3eAGF6TjNxS6Wo0uu228E7fGlmIzocc7U`
All the Env variables required for AO plugin can be generated using the following script:

```bash
node ./scripts/setupClaraProfile.mjs
```

At the start the agent profile is automatically generated and profile id is stored in dir `./profiles`.
The profile is also automatically registered on marketplace.


## Installtion

```bash
pnpm install --no-frozen-lockfile
```


## Building

```bash
pnpm build
```




## Usage

In order to delegate tasks to AI agents: 
 - Start the agent 

```bash 
pnpm start 
```

 -  Start the web client

```bash
pnpm start:client
```

 - Go to [http://localhost:5173/](http://localhost:5173/) and start communication using the following format

```
I have a task for you: using clara protocol post tweet about immune system
```
