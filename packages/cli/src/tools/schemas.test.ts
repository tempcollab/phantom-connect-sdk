import { getAddress } from "viem";
import { z } from "incur";
import {
  Base64Schema,
  Caip19Schema,
  Caip2ChainIdSchema,
  DerivationIndexSchema,
  EthereumAddressSchema,
  EvmCaip2ChainIdSchema,
  EvmChainIdSchema,
  HexStringSchema,
  PercentageSchema,
  PositiveNumericStringSchema,
  SolanaAddressSchema,
  SolanaCaip2ChainIdSchema,
  WalletIdSchema,
} from "./schemas";

const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDC_CHECKSUM = getAddress(USDC_MAINNET);
const SOL_MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_WRAPPED = "So11111111111111111111111111111111111111112";

describe("DerivationIndexSchema", () => {
  it("accepts non-negative integers", () => {
    expect(DerivationIndexSchema.parse(0)).toBe(0);
    expect(DerivationIndexSchema.parse(42)).toBe(42);
  });

  it("coerces numeric strings", () => {
    expect(DerivationIndexSchema.parse("7")).toBe(7);
  });

  it("defaults undefined to 0", () => {
    expect(DerivationIndexSchema.parse(undefined)).toBe(0);
  });

  it("rejects negative values", () => {
    const r = DerivationIndexSchema.safeParse(-1);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [], message: "Too small: expected number to be >=0" })]),
    );
  });

  it("rejects non-integers", () => {
    const r = DerivationIndexSchema.safeParse(1.5);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: [], message: "Invalid input: expected int, received number" }),
      ]),
    );
  });

  it("rejects values outside safe integer range", () => {
    const r = DerivationIndexSchema.safeParse(Number.MAX_SAFE_INTEGER + 1);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: [], message: "derivationIndex must be a safe integer" }),
      ]),
    );
  });

  it("rejects non-numeric strings that coerce to NaN", () => {
    const r = DerivationIndexSchema.safeParse("not-a-number");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: [], message: "Invalid input: expected number, received NaN" }),
      ]),
    );
  });
});

describe("WalletIdSchema", () => {
  it("accepts undefined", () => {
    expect(WalletIdSchema.parse(undefined)).toBeUndefined();
  });

  it("accepts any string including empty", () => {
    expect(WalletIdSchema.parse("wallet-abc")).toBe("wallet-abc");
    expect(WalletIdSchema.parse("")).toBe("");
  });

  it("rejects null", () => {
    const r = WalletIdSchema.safeParse(null);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
  });
});

describe("EthereumAddressSchema", () => {
  it("normalizes valid addresses to EIP-55 checksum", () => {
    expect(EthereumAddressSchema.parse(USDC_MAINNET.toLowerCase())).toBe(USDC_CHECKSUM);
    expect(EthereumAddressSchema.parse(USDC_CHECKSUM)).toBe(USDC_CHECKSUM);
  });

  it("rejects invalid hex", () => {
    const r = EthereumAddressSchema.safeParse("0xnothex");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues[0]?.message).toBe("Invalid Ethereum address — must be a 0x-prefixed 40-char hex string");
  });

  it("rejects wrong length", () => {
    const r = EthereumAddressSchema.safeParse("0x1234");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues[0]?.message).toBe("Invalid Ethereum address — must be a 0x-prefixed 40-char hex string");
  });

  it("rejects missing 0x prefix", () => {
    const r = EthereumAddressSchema.safeParse("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
  });
});

describe("SolanaAddressSchema", () => {
  it("accepts a valid base58 public key and returns the same string", () => {
    expect(SolanaAddressSchema.parse(SOL_WRAPPED)).toBe(SOL_WRAPPED);
    expect(SolanaAddressSchema.parse(SOL_MAINNET_USDC_MINT)).toBe(SOL_MAINNET_USDC_MINT);
  });

  it("rejects invalid base58", () => {
    const r = SolanaAddressSchema.safeParse("!!!not-base58!!!");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues[0]?.message).toBe("Invalid Solana address — must be a valid base58-encoded public key");
  });

  it("rejects too-short base58", () => {
    const r = SolanaAddressSchema.safeParse("short");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
  });
});

describe("Caip2ChainIdSchema", () => {
  it.each([
    "eip155:1",
    "solana:mainnet",
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    "bip122:000000000019d6689c085ae165831e93",
  ])("accepts %s", id => {
    expect(Caip2ChainIdSchema.parse(id)).toBe(id);
  });

  it("rejects strings without a colon", () => {
    const r = Caip2ChainIdSchema.safeParse("eip1551");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Must be a valid CAIP-2 chain ID (e.g. "eip155:1", "solana:mainnet", "eip155:8453")',
        }),
      ]),
    );
  });

  it("rejects empty namespace or reference", () => {
    expect(Caip2ChainIdSchema.safeParse(":1").success).toBe(false);
    expect(Caip2ChainIdSchema.safeParse("eip155:").success).toBe(false);
  });

  it("rejects colons inside segments where regex disallows", () => {
    expect(Caip2ChainIdSchema.safeParse("eip155:1:extra").success).toBe(false);
  });
});

describe("EvmCaip2ChainIdSchema", () => {
  it("accepts eip155-prefixed CAIP-2 IDs", () => {
    expect(EvmCaip2ChainIdSchema.parse("eip155:1")).toBe("eip155:1");
    expect(EvmCaip2ChainIdSchema.parse("eip155:8453")).toBe("eip155:8453");
  });

  it("rejects non-EVM CAIP-2 chains", () => {
    const r = EvmCaip2ChainIdSchema.safeParse("solana:mainnet");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message:
            'Must be an EVM chain ID starting with "eip155:" (e.g. "eip155:1" for Ethereum, "eip155:8453" for Base)',
        }),
      ]),
    );
  });
});

describe("SolanaCaip2ChainIdSchema", () => {
  it("accepts solana-prefixed CAIP-2 IDs", () => {
    expect(SolanaCaip2ChainIdSchema.parse("solana:mainnet")).toBe("solana:mainnet");
    expect(SolanaCaip2ChainIdSchema.parse("solana:101")).toBe("solana:101");
  });

  it("rejects non-Solana CAIP-2 chains", () => {
    const r = SolanaCaip2ChainIdSchema.safeParse("eip155:1");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Must be a Solana chain ID starting with "solana:" (e.g. "solana:mainnet", "solana:devnet")',
        }),
      ]),
    );
  });
});

describe("EvmChainIdSchema", () => {
  it("accepts numbers and numeric strings", () => {
    expect(EvmChainIdSchema.parse(1)).toBe(1);
    expect(EvmChainIdSchema.parse(8453)).toBe(8453);
    expect(EvmChainIdSchema.parse("8453")).toBe("8453");
    expect(EvmChainIdSchema.parse("0x2105")).toBe("0x2105");
  });

  it("rejects undefined", () => {
    const r = EvmChainIdSchema.safeParse(undefined);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues[0]?.message).toBe("Invalid input");
  });

  it("rejects null", () => {
    const r = EvmChainIdSchema.safeParse(null);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
  });
});

describe("Caip19Schema", () => {
  it("rejects empty string", () => {
    const r = Caip19Schema.safeParse("");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Must be a valid CAIP-19 identifier in the form "chainId/assetNamespace:assetReference"',
        }),
      ]),
    );
  });

  it("accepts EVM erc20 with valid contract address", () => {
    const id = `eip155:1/erc20:${USDC_MAINNET}`;
    expect(Caip19Schema.parse(id)).toBe(id);
  });

  it("accepts EVM address namespace with valid hex", () => {
    const id = `eip155:1/address:${USDC_MAINNET}`;
    expect(Caip19Schema.parse(id)).toBe(id);
  });

  it("accepts Solana token with valid mint", () => {
    const id = `solana:101/token:${SOL_MAINNET_USDC_MINT}`;
    expect(Caip19Schema.parse(id)).toBe(id);
  });

  it("accepts slip44 and nativeToken with numeric reference", () => {
    expect(Caip19Schema.parse("solana:101/slip44:501")).toBe("solana:101/slip44:501");
    expect(Caip19Schema.parse("solana:101/nativeToken:501")).toBe("solana:101/nativeToken:501");
  });

  it("accepts non-EVM non-Solana CAIP-19 without address cross-check", () => {
    expect(Caip19Schema.parse("bip122:abc/token:whatever")).toBe("bip122:abc/token:whatever");
  });

  it("rejects missing slash", () => {
    const r = Caip19Schema.safeParse("eip155:1erc20:0xabc");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Must be a valid CAIP-19 identifier in the form "chainId/assetNamespace:assetReference"',
        }),
      ]),
    );
  });

  it("rejects invalid CAIP-2 chain segment", () => {
    const r = Caip19Schema.safeParse("bad/erc20:0xabc");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: [], message: 'Invalid CAIP-2 chain ID in CAIP-19: "bad"' }),
      ]),
    );
  });

  it("rejects asset reference without colon", () => {
    const r = Caip19Schema.safeParse("eip155:1/erc20only");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Invalid asset reference in CAIP-19 — must be "namespace:reference", got "erc20only"',
        }),
      ]),
    );
  });

  it("rejects invalid EVM token address on erc20", () => {
    const r = Caip19Schema.safeParse("eip155:1/erc20:0x123");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'EVM erc20 address must be a 0x-prefixed 40-char hex string, got "0x123"',
        }),
      ]),
    );
  });

  it("rejects invalid EVM address on address namespace", () => {
    const r = Caip19Schema.safeParse("eip155:1/address:0xdead");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'EVM address address must be a 0x-prefixed 40-char hex string, got "0xdead"',
        }),
      ]),
    );
  });

  it("rejects invalid Solana mint on token namespace", () => {
    const r = Caip19Schema.safeParse("solana:101/token:notvalidmint");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Solana token address must be a valid base58-encoded public key, got "notvalidmint"',
        }),
      ]),
    );
  });

  it("rejects non-numeric slip44 reference", () => {
    const r = Caip19Schema.safeParse("solana:101/slip44:abc");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'slip44 asset reference must be a non-negative integer, got "abc"',
        }),
      ]),
    );
  });

  it("rejects non-numeric nativeToken reference", () => {
    const r = Caip19Schema.safeParse("solana:101/nativeToken:-1");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'nativeToken asset reference must be a non-negative integer, got "-1"',
        }),
      ]),
    );
  });
});

describe("PercentageSchema", () => {
  it("accepts finite numbers in [0, 100]", () => {
    expect(PercentageSchema.parse(0)).toBe(0);
    expect(PercentageSchema.parse(100)).toBe(100);
    expect(PercentageSchema.parse(37.5)).toBe(37.5);
  });

  it("rejects non-finite numbers", () => {
    const nan = PercentageSchema.safeParse(NaN);
    if (nan.success) {
      throw new Error("expected parse to fail");
    }
    expect(nan.error.issues[0]?.message).toBe("Invalid input: expected number, received NaN");
    const inf = PercentageSchema.safeParse(Infinity);
    if (inf.success) {
      throw new Error("expected parse to fail");
    }
    expect(inf.error.issues[0]?.message).toBe("Invalid input: expected number, received number");
  });

  it("rejects out-of-range values", () => {
    const low = PercentageSchema.safeParse(-0.01);
    if (low.success) {
      throw new Error("expected parse to fail");
    }
    expect(low.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [], message: "Too small: expected number to be >=0" })]),
    );
    const high = PercentageSchema.safeParse(100.01);
    if (high.success) {
      throw new Error("expected parse to fail");
    }
    expect(high.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [], message: "Too big: expected number to be <=100" })]),
    );
  });

  it("coerces numeric strings (CLI arg support)", () => {
    expect(PercentageSchema.parse("50")).toBe(50);
    expect(PercentageSchema.parse("0")).toBe(0);
    expect(PercentageSchema.parse("100")).toBe(100);
  });

  it("rejects non-numeric strings", () => {
    const r = PercentageSchema.safeParse("abc");
    expect(r.success).toBe(false);
  });
});

describe("PositiveNumericStringSchema", () => {
  const refineMessage = "Must be a positive number string (e.g. '100' or '10.5')";

  it.each(["1", "42", "10.5", "0.25", "1e-2", "100"])("accepts %s", v => {
    expect(PositiveNumericStringSchema.parse(v)).toBe(v);
  });

  it("rejects empty, non-positive, non-finite, and non-numeric string values", () => {
    for (const bad of ["", "   ", "0", "-1", "abc", "-0.1", "Infinity", "-Infinity", "NaN", "1e1000"]) {
      const r = PositiveNumericStringSchema.safeParse(bad);
      if (r.success) {
        throw new Error(`expected parse to fail for ${JSON.stringify(bad)}`);
      }
      expect(r.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: [], message: refineMessage })]),
      );
    }
  });

  it("rejects non-string types", () => {
    const r = PositiveNumericStringSchema.safeParse(5 as unknown);
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues[0]?.message).toBe("Invalid input: expected string, received number");
  });

  it("rejects missing property when used in an object schema", () => {
    const Obj = z.object({ x: PositiveNumericStringSchema });
    const r = Obj.safeParse({});
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["x"],
          message: "Invalid input: expected string, received undefined",
        }),
      ]),
    );
  });
});

describe("HexStringSchema", () => {
  it.each(["0x", "0x0", "0xabcdef", "0xABCDEF1234"])("accepts %s", hex => {
    expect(HexStringSchema.parse(hex)).toBe(hex);
  });

  it("accepts odd-length hex after 0x", () => {
    expect(HexStringSchema.parse("0xabc")).toBe("0xabc");
  });

  it("rejects without 0x prefix", () => {
    const r = HexStringSchema.safeParse("abcdef");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Must be a 0x-prefixed hex string (e.g. "0x", "0x1234abcd")',
        }),
      ]),
    );
  });

  it("rejects non-hex characters", () => {
    const r = HexStringSchema.safeParse("0xgg");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: 'Must be a 0x-prefixed hex string (e.g. "0x", "0x1234abcd")',
        }),
      ]),
    );
  });
});

describe("Base64Schema", () => {
  it("accepts empty string", () => {
    expect(Base64Schema.parse("")).toBe("");
  });

  it("accepts valid standard base64 with padding", () => {
    expect(Base64Schema.parse("YQ==")).toBe("YQ==");
    expect(Base64Schema.parse("SGVsbG8=")).toBe("SGVsbG8=");
  });

  it("accepts unpadded length multiple of 4", () => {
    expect(Base64Schema.parse("YWFh")).toBe("YWFh");
  });

  it("rejects base64url alphabet", () => {
    const r = Base64Schema.safeParse("YQ-_");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
  });

  it("rejects invalid length modulo 4 === 1", () => {
    const r = Base64Schema.safeParse("A");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues.some(i => i.message === "Base64 string has invalid length — check padding")).toBe(true);
  });

  it("rejects characters outside standard base64", () => {
    const r = Base64Schema.safeParse("!!!");
    if (r.success) {
      throw new Error("expected parse to fail");
    }
    expect(r.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [],
          message: "Must be a valid standard base64 string (A-Za-z0-9+/= with correct padding)",
        }),
      ]),
    );
  });
});
