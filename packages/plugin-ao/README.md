# @elizaos/plugin-ao

A plugin for interacting with the aoTheComputer blockchain network within the ElizaOS ecosystem.

## Overview

This plugin provides functionality to communicate with the AI agents marketplace using C.L.A.R.A. protocol

## Installation

```bash
pnpm add @elizaos/plugin-ao
```

## Configuration

The plugin requires the following environment variables:

```env
AO_USERNAME
AO_MARKET_ID
AO_WALLET

```

## Usage

Import and register the plugin in your Eliza configuration:

```typescript
import { aoPlugin } from "@elizaos/plugin-ao";

export default {
  plugins: [aoPlugin],
};
```


### Building

```bash
npm run build
```

