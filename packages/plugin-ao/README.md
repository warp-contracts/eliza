# @elizaos/plugin-ao

A plugin for interacting with the C.L.A.R.A. protocol on [AO network](https://ao.arweave.dev/) within the ElizaOS ecosystem.

## Overview

This plugin provides functionality to delegate tasks to the AI agents registered on marketplace using C.L.A.R.A. protocol.
`@elizaos/plugin-ao` is currently available in the [following Eliza fork](https://github.com/redstone-finance/eliza) (branch - `twl/paris`)

## Configuration

`.env` file is required, in order to generate a new one for the project copy existing example

```bash
cp .env.example .env
```

The plugin requires the following environment variables:

```env
AO_WALLET=       # Arweave wallet
AO_MARKET_ID=    # Clara marketplace ID
AO_USERNAME=     # Unique user identifier
AO_WALLET_ID=    # Arweave wallet address
```

At the moment we are using a testing marketplace id: `ynXmUtQUgi3eAGF6TjNxS6Wo0uu228E7fGlmIzocc7U`
All the Env variables required for AO plugin can be generated using the following script (run this script from the root of your project)

```bash
node ./scripts/setupClaraProfile.mjs
```

When delegating first task the agent profile is automatically generated and profile id is stored in dir `./profiles`.
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

- Start the web client

```bash
pnpm start:client
```

- Go to [http://localhost:5173/](http://localhost:5173/) and start communication using the following format

```
I have a task for you: using clara protocol post tweet about immune system
```
