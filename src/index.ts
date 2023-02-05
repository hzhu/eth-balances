import { isAddress } from "@ethersproject/address";
import { formatUnits } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { HashZero } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { parseBytes32String } from "@ethersproject/strings";
import { defaultAbiCoder, Interface } from "@ethersproject/abi";
import { abi as erc20Abi } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import multicallAbi from "./abi/multicall.json";
import type { BytesLike } from "@ethersproject/bytes";
import type { Provider } from "@ethersproject/providers";

const MULTICALL3_CONTRACT = "0xcA11bde05977b3631167028862bE2a173976CA11";

const fragmentTypes = erc20Abi.reduce<Record<string, string>>(
  (typesByName, abiItem) => {
    const { name, outputs } = abiItem;
    if (outputs) {
      return {
        ...typesByName,
        [name]: outputs[0].type,
      };
    }
    return typesByName;
  },
  {}
);

interface Call {
  target: string;
  callData: string;
}

interface CallContext {
  contractAddress: string;
  methodName: string;
}

interface BalanceRequest {
  addressOrName: string;
  contractAddresses: string[];
  provider: Provider;
}

interface RawBalanceRequest {
  address: string;
  contractAddresses: string[];
  provider: Provider;
}

type ReturnData = BytesLike;

type Success = boolean;

export type CallResult = [Success, ReturnData];

type ContractAddress = string;

export type AssociatedCallResult = [ContractAddress, Success, ReturnData];

type BlockHash = string;

type AggregateResponse = [BigNumber, BlockHash, CallResult[]];

type TokenInfo = Record<
  "symbol" | "balanceOf" | "decimals" | "name",
  string | number
>;

type TokenInfoWithoutBalance = Record<
  "symbol" | "decimals" | "name",
  string | number
>;

export type MetaByContract = Record<string, TokenInfoWithoutBalance>;

type BalancesByContract = Record<string, TokenInfo>;

/**
 * Fetches the balances in a single batch using Multicall (tryBlockAndAggregate)
 *
 * @param request - An request object used to fetch balances
 * @returns An array of tuples that contain the non-zero result data along with its smart contract address
 */
export async function fetchRawBalances({
  address,
  contractAddresses,
  provider,
}: RawBalanceRequest): Promise<AssociatedCallResult[]> {
  const erc20Interface = new Interface(erc20Abi);
  const balanceCalls: Call[] = contractAddresses.map((contractAddress) => ({
    target: contractAddress,
    callData: erc20Interface.encodeFunctionData("balanceOf", [address]),
  }));
  const { results } = await aggregate(balanceCalls, provider);
  const nonZeroResults = getNonZeroResults(results, contractAddresses);

  return nonZeroResults;
}

/**
 * Filters out call result data with zero balance and return non zero results associated with its contract
 *
 * @param results - An array of raw call results from multicall (balanceOf)
 * @param contractAddresses - An array of contract addresses, one element per result
 * @returns The non-zero result data, associated with its contract address
 */
export function getNonZeroResults(
  results: CallResult[],
  contractAddresses: string[]
) {
  return results
    .map<AssociatedCallResult>((result, index) => [
      contractAddresses[index],
      ...result,
    ])
    .filter(({ 2: data }) => {
      const hasBalance = data !== HashZero;
      const expectedFormat = data.length === HashZero.length;
      return hasBalance && expectedFormat;
    });
}

/**
 * Takes an tuple of call results and returns an object with each result keyed by its contract address
 *
 * @param associatedCallResults - An array of tuples that contain the raw balance and its contract address
 * @returns An object with each raw result keyed by its contract address
 */
export function resultDataByContract(
  associatedCallResults: AssociatedCallResult[]
) {
  return associatedCallResults.reduce<Record<string, ReturnData>>(
    (balances, result) => {
      const { 0: contractAddress, 2: data } = result;
      return {
        ...balances,
        [contractAddress]: data,
      };
    },
    {}
  );
}

/**
 * Takes an associated call result (contract address + result data) and generates:
 * 1) calls is used to fetch a token's name, symbol, and decimals
 * 2) context is useful  for mapping raw result data of a method call to its contract address
 *
 * @param associatedResults - The result data, associated with its contract address
 * @returns The calls and context
 */
export function buildCallsContext(associatedResults: AssociatedCallResult[]) {
  const calls: Call[] = [];
  const context: CallContext[] = [];
  const contractAddresses = associatedResults.map((result) => result[0]);
  const erc20Interface = new Interface(erc20Abi);
  contractAddresses.forEach((contractAddress) => {
    ["symbol", "decimals", "name"].forEach((methodName) => {
      calls.push({
        target: contractAddress,
        callData: erc20Interface.encodeFunctionData(methodName),
      });
      context.push({
        contractAddress,
        methodName,
      });
    });
  });

  return { calls, context };
}

/**
 * Decodes the raw result data for meta info such as ERC-20's (name, symbol, address)`.
 * Returns these decoded results in an object keyed by its smart contract address.
 * @param metaResults - An array of call result for each ERC-20 meta data (name, symbol, address)
 * @param context - T
 * @returns T
 */
export function decodeMetaResults(
  metaResults: CallResult[],
  context: CallContext[]
): MetaByContract {
  return metaResults.reduce((meta: BalancesByContract, result, index) => {
    let methodValue;
    const { 1: data } = result;
    const { contractAddress, methodName } = context[index];

    try {
      const type = fragmentTypes[methodName];
      [methodValue] = defaultAbiCoder.decode([type], data);
    } catch (error) {
      console.info(
        `Problem decoding ${methodName} for ${contractAddress}. The contract is likely not ERC-20 compliant.`
      );
      methodValue = parseBytes32String(data);
    }

    return {
      ...meta,
      [contractAddress]: {
        ...meta[contractAddress],
        [methodName]: methodValue,
      },
    };
  }, {});
}

/**
 * Takes the meta data (name, symbol, decimals) and the balance data and normalizes
 * normalizes them into an object keyed by its smart contract address.
 *
 * @param metaDataByContract - An object of meta data (name, symbol, decimals) keyed by its contract address
 * @param balanceDataByContract - An object of raw balance data keyed by its contract address
 * @returns The non-zero balance and its name, symbol, and decimnals, keyed by its contract address
 */
export function balancesByContract(
  metaDataByContract: MetaByContract,
  balanceDataByContract: Record<string, ReturnData>
) {
  return Object.keys(metaDataByContract).reduce<Record<string, TokenInfo>>(
    (balances, contractAddress) => {
      const { decimals } = metaDataByContract[contractAddress];
      const balanceHexString = balanceDataByContract[contractAddress];
      const decoded = defaultAbiCoder.decode(["uint256"], balanceHexString);
      const balance = formatUnits(decoded.toString(), decimals);

      return {
        ...balances,
        [contractAddress]: {
          ...metaDataByContract[contractAddress],
          balanceOf: balance,
        },
      };
    },
    {}
  );
}

/**
 * Gets an Ethereum address from an Ethereum address or ENS domain
 *
 * @param addressOrName - An Ethereum address or ENS domain
 * @param provider - An abstraction of a connection to the EVM network which provides node functionality
 * @returns An Ethereum address
 */
export async function getAddress(addressOrName: string, provider: Provider) {
  if (isAddress(addressOrName)) return addressOrName;
  const { chainId, name } = await provider.getNetwork();

  if (chainId === 1) {
    const address = await provider.resolveName(addressOrName);
    if (address) {
      return address;
    } else {
      throw new Error("Invalid ENS domain.");
    }
  } else {
    // See: https://github.com/ethers-io/ethers.js/issues/310
    const network = name.charAt(0).toUpperCase() + name.slice(1);
    throw new Error(
      `${network} does not support ENS. See https://github.com/ethers-io/ethers.js/issues/310`
    );
  }
}

/**
 * Returns the ERC20 balances for an Ethereum address using the
 * {@link https://github.com/mds1/multicall#multicall--- multicall smart contract}
 *
 * @param BalanceRequest - The request used to fetch ERC20 balances
 * @returns The ERC-20 balances for an address
 */
export async function getTokenBalances({
  addressOrName,
  contractAddresses,
  chunkSize = 500,
  provider,
}: BalanceRequest & {
  chunkSize?: number;
}): Promise<BalancesByContract> {
  const address = await getAddress(addressOrName, provider);
  const chunked = chunk(contractAddresses, chunkSize);
  const results = await Promise.all(
    chunked.map((chunk) =>
      fetchRawBalances({ address, contractAddresses: chunk, provider })
    )
  );
  const rawBalanceResults = results.reduce((acc, res) => [...acc, ...res], []);
  const rawBalances = resultDataByContract(rawBalanceResults);
  const { calls, context } = buildCallsContext(rawBalanceResults);
  const { results: metaResults } = await aggregate(calls, provider);
  const decodedMetaResults = decodeMetaResults(metaResults, context);

  return balancesByContract(decodedMetaResults, rawBalances);
}

/**
 * A helper function to make requests to the multicall smart contract (tryBlockAndAggregate)
 *
 * @param calls - An array of calls that will be executed in a batch by the multicall contract (tryBlockAndAggregate)
 * @param provider - An abstraction of a connection to the EVM network which provides node functionality
 * @returns The results from tryBlockAndAggregate
 */
export async function aggregate(calls: Call[], provider: Provider) {
  const contract = new Contract(MULTICALL3_CONTRACT, multicallAbi, provider);
  const { 2: results } = (await contract.callStatic.tryBlockAndAggregate(
    false,
    calls
  )) as AggregateResponse;

  return { results };
}

/**
 * Utility function to chunk an array into arrays of `size`
 *
 * @param array - The array to be chunked
 * @param size - The size of each chunk
 * @returns An array of chunks
 */
export function chunk<T>(array: T[], size: number) {
  const chunked: T[][] = [];
  let chunk: T[] = [];
  array.forEach((item: T) => {
    if (chunk.length === size) {
      chunked.push(chunk);
      chunk = [item];
    } else {
      chunk.push(item);
    }
  });

  if (chunk.length) {
    chunked.push(chunk);
  }

  return chunked;
}
