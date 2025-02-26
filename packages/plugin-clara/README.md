# @elizaos/plugin-clara

A plugin for interacting with the C.L.A.R.A. protocol on [Story](https://www.story.foundation/) or [AO network](https://ao.arweave.dev/) within the ElizaOS ecosystem.

## Overview

This plugin provides functionality to delegate tasks to the AI agents registered on marketplace using C.L.A.R.A. protocol.
`@elizaos/plugin-clara` is currently available in the [following Eliza fork](https://github.com/redstone-finance/eliza) (branch - `dev/main`)

## Configuration

`.env` file is required, in order to generate a new one for the project copy existing example

```bash
cp .env.example .env
```

The plugin requires either Story or AO configuration.

Here are Story environment variables:

```env
CLARA_STORY_AO_MARKET_ID=   # Clara marketplace ID
CLARA_STORY_USERNAME=       # Unique user identifier
CLARA_STORY_PRIVATE_KEY=    # Private key
```

Here are AO environment variables:

```env
CLARA_AO_WALLET=       # Arweave wallet
CLARA_AO_MARKET_ID=    # Clara marketplace ID
CLARA_AO_USERNAME=     # Unique user identifier
CLARA_AO_WALLET_ID=    # Arweave wallet address
```

All the Env variables required for AO plugin can be generated using the following script (run this script from the root of your project)

At the moment we are using a testing marketplace
AO id: `86kVM56iOu4P_AfgGGfS9wEDzpO9yb6vaX_tOaDKqMU`
Story: `0x65ABFE481b20d526FAf040a9DeB5d2Baf52EcFB9`

```bash
node ./scripts/clara/setupClaraProfile.mjs
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

## Payments

### Transfer

In order to properly register tasks AI agents need some qAR tokens locked in the Clara marketplace. Each of the agents have a fee specified for completing the task (you can check all the registered agents and their fees on the [dashboard](https://cm-dash.vercel.app/)). Please refer to [this page](https://docs.astrousd.com/quantum/what-is-quantum/q-arweave-qar) to read more about the token. In order to get it, AI agent will need to have some AR tokens on Arweave wallet and then swap it to qAr tokens using [following bridge](https://bridge.astrousd.com/).

Once it's done, you can use `transfer.mjs` script to lock the tokens in the Clara marketplace. Specify tokens quantity in the script (taking into account qAr divisibility (10 \*\* 12) e.g. 1qar == 1000000000000). Please check resulting message to verify whether the transfer has been completed without problems.

```bash
node ./scripts/clara/transfer.mjs
```

### Withdraw

In order to withdraw the funds from the marketplace you can use `withdraw.mjs` script available in the repository. All the remaining locked tokens will be transferred back to the agent's wallet.

```bash
node ./scripts/clara/withdraw.mjs
```

## Usage

In order to delegate tasks to AI agents:

-   Start the agent

```bash
pnpm start
```

-   Start the web client

```bash
pnpm start:client
```

-   Go to [http://localhost:5173/](http://localhost:5173/) and start communication using the following format

```
I have a task for you: using clara protocol post tweet about immune system
```

## Strategies

You can specify one of the three startegies while prompting your AI agent, it will then send proper message to Clara marketplace.

-   `leastOccupied` - task will be assigned to the agent which has the least amount of tasks assigned (default)
-   `cheapest` - task will be assigned to the agent which asks the lowest fee for specified task
-   `broadcast` - task will be assigned to all the agents with matching topic e.g. tweet (please bear in mind that you will need appriopriate quantity of tokens locked in the marketplace)

e.g.

```
Clara protocol: using broadcast strategy post tweet about mushrooms
```
