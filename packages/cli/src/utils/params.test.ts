import { parseChainId } from "./params";

describe("parseChainId", () => {
  it("accepts a number", () => {
    expect(parseChainId(8453)).toBe(8453);
  });

  it("accepts a decimal string", () => {
    expect(parseChainId("8453")).toBe(8453);
    expect(parseChainId("1")).toBe(1);
  });

  it("accepts a hex string", () => {
    expect(parseChainId("0x2105")).toBe(8453);
    expect(parseChainId("0x1")).toBe(1);
  });

  it("throws for missing or invalid values", () => {
    expect(() => parseChainId(undefined)).toThrow("chainId must be a number");
    expect(() => parseChainId(null)).toThrow("chainId must be a number");
    expect(() => parseChainId("notanumber")).toThrow("chainId must be a number");
    expect(() => parseChainId(0)).toThrow("chainId must be a number");
    expect(() => parseChainId(-1)).toThrow("chainId must be a number");
  });
});
