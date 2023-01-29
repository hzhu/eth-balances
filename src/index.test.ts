import { describe, expect, it, vi } from "vitest";
import { BaseProvider } from "@ethersproject/providers";
import {
  chunk,
  aggregate,
  getAddress,
  buildCallsContext,
  decodeMetaResults,
  getNonZeroResults,
  resultDataByContract,
  balancesByContract,
  fetchRawBalances,
  getTokenBalances,
} from "./index";
import type { Network, Provider } from "@ethersproject/providers";
import type { CallResult, AssociatedCallResult, MetaByContract } from "./";

class MockProvider extends BaseProvider {
  async detectNetwork(): Promise<Network> {
    return { chainId: 1, name: "ethereum" };
  }
  async perform(method, params) {
    if (method === "getBlockNumber") {
      return 1337;
    }
    if (method === "call") {
      // hardcoded byte data
      const byteDataFromTryBlockAndAggregate =
        "0x0000000000000000000000000000000000000000000000000000000000fa98500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004574554480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d5772617070656420457468657200000000000000000000000000000000000000";
      return byteDataFromTryBlockAndAggregate;
    }
    return super.perform(method, params);
  }
}

describe("getNonZeroResults", () => {
  it("filters out zero balance results and associates non-zero balances to the externally owned account", () => {
    const results: CallResult[] = [
      [
        true,
        "0x000000000000000000000000000000000000000000000000b50ae81b7c121a29",
      ],
      [
        true,
        "0x0000000000000000000000000000000000000000000000027ebcbd6cf1e63a9b",
      ],
      [
        true,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    ];
    const contractAddresses = [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH, non-zero balance
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498", //  ZRX, non-zero balance
      "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", //  RPL, zero balance
    ];

    expect(getNonZeroResults(results, contractAddresses)).toEqual([
      [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        true,
        "0x000000000000000000000000000000000000000000000000b50ae81b7c121a29",
      ],
      [
        "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        true,
        "0x0000000000000000000000000000000000000000000000027ebcbd6cf1e63a9b",
      ],
    ]);
  });
});

describe("buildCallsContext", () => {
  it("builds the calls for tryBlockAndAggregate and the context to join them together", () => {
    const results: AssociatedCallResult[] = [
      [
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        true,
        "0x000000000000000000000000000000000000000000000000b50ae81b7c121a29",
      ],
      [
        "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        true,
        "0x0000000000000000000000000000000000000000000000027ebcbd6cf1e63a9b",
      ],
    ];
    const context = [
      {
        contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        methodName: "symbol",
      },
      {
        contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        methodName: "decimals",
      },
      {
        contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        methodName: "name",
      },
      {
        contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        methodName: "symbol",
      },
      {
        contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        methodName: "decimals",
      },
      {
        contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        methodName: "name",
      },
    ];

    const calls = [
      {
        target: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        callData: "0x95d89b41",
      },
      {
        target: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        callData: "0x313ce567",
      },
      {
        target: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        callData: "0x06fdde03",
      },
      {
        target: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        callData: "0x95d89b41",
      },
      {
        target: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        callData: "0x313ce567",
      },
      {
        target: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        callData: "0x06fdde03",
      },
    ];
    expect(buildCallsContext(results)).toEqual({ context, calls });
  });
});

describe("decodeMetaResults", () => {
  it("decodes meta data into human readable results, keyed by contract address", () => {
    const metaResults: CallResult[] = [
      [
        true,
        "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003554e490000000000000000000000000000000000000000000000000000000000",
      ],
      [
        true,
        "0x0000000000000000000000000000000000000000000000000000000000000012",
      ],
      [
        true,
        "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000007556e697377617000000000000000000000000000000000000000000000000000",
      ],
      [
        true,
        "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000035a52580000000000000000000000000000000000000000000000000000000000",
      ],
      [
        true,
        "0x0000000000000000000000000000000000000000000000000000000000000012",
      ],
      [
        true,
        "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001130782050726f746f636f6c20546f6b656e000000000000000000000000000000",
      ],
    ];
    const context = [
      {
        contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        methodName: "symbol",
      },
      {
        contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        methodName: "decimals",
      },
      {
        contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        methodName: "name",
      },
      {
        contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        methodName: "symbol",
      },
      {
        contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        methodName: "decimals",
      },
      {
        contractAddress: "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        methodName: "name",
      },
    ];
    expect(decodeMetaResults(metaResults, context)).toEqual({
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": {
        symbol: "UNI",
        decimals: 18,
        name: "Uniswap",
      },
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498": {
        symbol: "ZRX",
        decimals: 18,
        name: "0x Protocol Token",
      },
    });
  });

  it("decodes results for contracts that are not erc-20 compliant and returns bytes32 for name and symbol", () => {
    const info = console.info;
    console.info = vi.fn();
    const metaResults: CallResult[] = [
      [
        true,
        "0x4441490000000000000000000000000000000000000000000000000000000000",
      ],
      [
        true,
        "0x0000000000000000000000000000000000000000000000000000000000000012",
      ],
      [
        true,
        "0x44616920537461626c65636f696e2076312e3000000000000000000000000000",
      ],
    ];
    const context = [
      {
        contractAddress: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
        methodName: "symbol",
      },
      {
        contractAddress: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
        methodName: "decimals",
      },
      {
        contractAddress: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
        methodName: "name",
      },
    ];
    expect(decodeMetaResults(metaResults, context)).toEqual({
      "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359": {
        symbol: "DAI",
        decimals: 18,
        name: "Dai Stablecoin v1.0",
      },
    });
    expect(console.info).toBeCalledTimes(2);
    expect(console.info).toBeCalledWith(
      "Problem decoding symbol for 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359. The contract is likely not ERC-20 compliant."
    );
    expect(console.info).toBeCalledWith(
      "Problem decoding name for 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359. The contract is likely not ERC-20 compliant."
    );
    console.info = info;
  });
});

describe("resultDataByContract", () => {
  it("gets the raw balances and normalizes the data by contract address", () => {
    const nonZeroResults: AssociatedCallResult[] = [
      [
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        true,
        "0x000000000000000000000000000000000000000000000000b50ae81b7c121a29",
      ],
      [
        "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        true,
        "0x0000000000000000000000000000000000000000000000027ebcbd6cf1e63a9b",
      ],
    ];
    expect(resultDataByContract(nonZeroResults)).toEqual({
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984":
        "0x000000000000000000000000000000000000000000000000b50ae81b7c121a29",
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498":
        "0x0000000000000000000000000000000000000000000000027ebcbd6cf1e63a9b",
    });
  });
});

describe("balancesByContract", () => {
  it("creates token balance info from decoded results and raw balances", () => {
    const decodedResults: MetaByContract = {
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": {
        symbol: "UNI",
        decimals: 18,
        name: "Uniswap",
      },
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498": {
        symbol: "ZRX",
        decimals: 18,
        name: "0x Protocol Token",
      },
    };
    const resultDataByContract = {
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984":
        "0x000000000000000000000000000000000000000000000000b50ae81b7c121a29",
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498":
        "0x0000000000000000000000000000000000000000000000027ebcbd6cf1e63a9b",
    };
    expect(balancesByContract(decodedResults, resultDataByContract)).toEqual({
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": {
        symbol: "UNI",
        decimals: 18,
        name: "Uniswap",
        balanceOf: "13.045494475375385129",
      },
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498": {
        symbol: "ZRX",
        decimals: 18,
        name: "0x Protocol Token",
        balanceOf: "46.025870567432141467",
      },
    });
  });
});

describe("aggregate", () => {
  it("returns result data from tryBlockAndAggregate multicall function", async () => {
    const calls = [
      {
        target: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI
        callData:
          "0x70a082310000000000000000000000008a6bfcae15e729fd1440574108437dea281a9b3e", // call data for balanceOf
      },
      {
        target: "0xE41d2489571d322189246DaFA5ebDe1F4699F498", // ZRX
        callData:
          "0x70a082310000000000000000000000008a6bfcae15e729fd1440574108437dea281a9b3e",
      },
      {
        target: "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", // RPL
        callData:
          "0x70a082310000000000000000000000008a6bfcae15e729fd1440574108437dea281a9b3e",
      },
    ];

    const provider = new MockProvider({ chainId: 1, name: "ethereum" });
    const result = await aggregate(calls, provider as BaseProvider);
    const expected = {
      results: [
        [
          true,
          "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045745544800000000000000000000000000000000000000000000000000000000",
        ],
        [
          true,
          "0x0000000000000000000000000000000000000000000000000000000000000012",
        ],
        [
          true,
          "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d5772617070656420457468657200000000000000000000000000000000000000",
        ],
      ],
    };

    result.results.forEach((result, index) => {
      expect(result[0]).toEqual(expected.results[index][0]);
      expect(result[1]).toEqual(expected.results[index][1]);
    });
  });
});

describe("utilities", () => {
  describe("chunk", () => {
    it("chunks an array of even length", () => {
      const chunked = chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2);
      expect(chunked).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        [9, 10],
      ]);
    });

    it("chunks an array of off length", () => {
      const chunked = chunk([1, 2, 3, 4, 5, 6, 7, 8, 9], 2);
      expect(chunked).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9]]);
    });
  });

  describe("getAddress", () => {
    it("returns the address immediately if valid address", async () => {
      const mockProvider = {
        getNetwork: async () => ({ chainId: 1, name: "ethereum" }),
        resolveName: async () => "0x9e0543517f8e678a5c307161405cf644c2dbfbb1",
      };
      expect(
        await getAddress(
          "0x9e0543517f8e678a5c307161405cf644c2dbfbb1",
          mockProvider as unknown as Provider
        )
      ).toBe("0x9e0543517f8e678a5c307161405cf644c2dbfbb1");
    });

    it("returns the address when given an ENS domain", async () => {
      const mockProvider = {
        getNetwork: async () => ({ chainId: 1, name: "ethereum" }),
        resolveName: async () => "0x9e0543517f8e678a5c307161405cf644c2dbfbb1",
      };
      expect(
        await getAddress("vitalik.eth", mockProvider as unknown as Provider)
      ).toBe("0x9e0543517f8e678a5c307161405cf644c2dbfbb1");
    });

    it.fails("throws when ENS is invalid", async () => {
      const mockProvider = {
        getNetwork: async () => ({ chainId: 1, name: "ethereum" }),
        resolveName: async () => null,
      };
      expect(
        await getAddress("zeroex-dev", mockProvider as unknown as Provider)
      ).toThrowError();
    });

    it.fails(
      "throws when using a network that does not support ENS",
      async () => {
        const mockProvider = {
          getNetwork: async () => ({ chainId: 137, name: "matic" }),
          resolveName: async () => "0x9e0543517f8e678a5c307161405cf644c2dbfbb1",
        };

        expect(
          await getAddress(
            "vitalik.eth",
            mockProvider as unknown as Provider
          )
        ).toThrowError();
      }
    );
  });
});

describe("fetchRawBalances", () => {
  it("gets raw non-zero balances by calling tryBlockAndAggregate", async () => {
    const contractAddresses = [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498", // ZRX
      "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", // RPL
    ];
    const provider = new MockProvider({ chainId: 1, name: "ethereum" });
    const rawBalanceResults = await fetchRawBalances({
      address: "0x9e0543517f8e678a5c307161405cf644c2dbfbb1",
      contractAddresses,
      provider,
    });

    expect(rawBalanceResults).toEqual([
      [
        "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
        true,
        "0x0000000000000000000000000000000000000000000000000000000000000012",
      ],
    ]);
  });
});

describe("getTokenBalances", () => {
  it("gets the balances normalized by contract address", async () => {
    const contractAddresses = [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498", // ZRX
      "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", // RPL
    ];
    const provider = new MockProvider({ chainId: 1, name: "ethereum" });

    const balances = await getTokenBalances({
      addressOrName: "0x9e0543517f8e678a5c307161405cf644c2dbfbb1",
      contractAddresses,
      provider,
    });

    expect(balances).toEqual({
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498": {
        symbol: "WETH",
        decimals: 18,
        name: "Wrapped Ether",
        balanceOf: "0.000000000000000018",
      },
    });
  });
});
