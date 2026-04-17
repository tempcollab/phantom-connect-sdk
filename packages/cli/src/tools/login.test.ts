import { loginTool } from "./login";

describe("phantom_login tool placeholder", () => {
  it("throws because phantom_login must be handled by the login command before root middleware", async () => {
    await expect(loginTool.handler({} as any, {} as any)).rejects.toThrow(
      "phantom_login must be handled by the CLI login command before root middleware runs — it cannot be dispatched through the normal tool handler.",
    );
  });
});
