const { StaticJsonRpcProvider } = require("@ethersproject/providers");
const { getAddress } = require("@ethersproject/address");
const { getTokenBalances } = require("../../dist/index.cjs");

const RPC_URL =
  "https://polygon-mainnet.g.alchemy.com/v2/2ZulmRPm8Kklt6G--5tqJn50WOP5lQCt";
const TOKEN_LIST = "https://api-polygon-tokens.polygon.technology/tokenlists/popularTokens.tokenlist.json";

const main = async () => {
  const provider = new StaticJsonRpcProvider(RPC_URL);
  const addressOrName = "0x8a6BFCae15E729fd1440574108437dEa281A9B3e";
  const response = await fetch(TOKEN_LIST);
  const tokenList = await response.json();
  const toChecksum = (token) => getAddress(token.address);
  const contractAddresses = tokenList.tokens.map(toChecksum);
  try {
    const balances = await getTokenBalances({
      addressOrName,
      contractAddresses,
      provider,
    });
    console.log(`Balances for ${addressOrName}: `, balances);
  } catch (error) {
    console.error(error);
  }
};

main();
