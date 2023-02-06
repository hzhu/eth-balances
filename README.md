# ⟠ eth-balances ⟠

[![npm version](https://img.shields.io/npm/v/@hzhu/eth-balances.svg?style=flat-square)](https://www.npmjs.com/package/@hzhu/eth-balances)
[![build and test](https://github.com/hzhu/eth-balances/actions/workflows/test.yml/badge.svg)](https://github.com/hzhu/eth-balances/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/hzhu/eth-balances/branch/main/graph/badge.svg?token=OnNsoc2OrF)](https://codecov.io/gh/hzhu/eth-balances)

A tiny library to get [ERC-20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/) token balances on EVM blockchains. It uses an aggregate function to fetch ERC20 token balances from multiple smart contracts in a single batch using the [Multicall contract](https://github.com/mds1/multicall).

## Installation

```
npm install @hzhu/eth-balances
```

Note: This package requires [Ethers](https://www.npmjs.com/package/ethers) to be installed in order to work.

## Usage

```typescript
import { JsonRpcProvider } from "ethers";
import { getTokenBalances } from "@hzhu/eth-balances";

const provider = new JsonRpcProvider(`https://YOUR-ETHEREUM-RPC-URL`);
const addressOrName = "henryzhu.eth";
const contractAddresses = [
  "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
  "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
];

const balances = await getTokenBalances({
  provider,
  addressOrName,
  contractAddresses,
});

console.log(balances);
```

## Examples

The `/examples` folder in this repository provides development examples for web browser and NodeJS usage.

1. Clone the repository
1. Run `npm install`
1. Run `npm run web:example` for the web browser example
1. Run `npm run node:example` for the NodeJS example

### Web example

<img src="https://raw.githubusercontent.com/hzhu/eth-balances/main/examples/web/example.web.png" alt="get balances web demo" width="500"/>

### NodeJS example

<img src="https://raw.githubusercontent.com/hzhu/eth-balances/main/examples/node/example.node.png" alt="get balances node.js demo" width="500"/>

## Contributing

Contributions are welcomed! Please follow the [contributing guidelines](./.github/.CONTRIBUTING.md).
