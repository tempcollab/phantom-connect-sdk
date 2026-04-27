import { tools } from "./index";

describe("tools registry", () => {
  it("has no duplicate tool names", () => {
    const names = tools.map(t => t.name);
    const unique = new Set(names);
    if (unique.size !== names.length) {
      throw new Error("Duplicate tool names found");
    }
    expect(unique.size).toBe(names.length);
  });
});
