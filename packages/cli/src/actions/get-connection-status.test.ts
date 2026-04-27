import { getConnectionStatusTool } from "./get-connection-status";

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe("get_connection_status", () => {
  it("returns connected=true with wallet and organization", async () => {
    const session = { walletId: "wallet-1", organizationId: "org-1" };
    const result = await getConnectionStatusTool.handler({}, {
      session,
      logger,
      manager: {
        isInitialized: () => true,
        getSession: () => session,
      },
    } as any);

    expect(result).toEqual({
      connected: true,
      walletId: "wallet-1",
      organizationId: "org-1",
      mcpServerVersion: expect.any(String),
    });
  });

  it("returns connected=false when session is missing wallet fields", async () => {
    const session = { walletId: "", organizationId: "" };
    const result = await getConnectionStatusTool.handler({}, {
      session,
      logger,
      manager: {
        isInitialized: () => false,
        getSession: () => session,
      },
    } as any);

    expect(result).toEqual({
      connected: false,
      reason: "No active session found. Call get_wallet_addresses to authenticate.",
      mcpServerVersion: expect.any(String),
    });
  });
});
