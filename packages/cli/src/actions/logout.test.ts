import { logoutTool } from "./logout";

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe("phantom_logout", () => {
  it("calls manager.logout() and returns success: true", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);

    const result = await logoutTool.handler({}, {
      logger,
      manager: { logout },
    } as any);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });

  it("propagates errors thrown by manager.logout()", async () => {
    const logout = jest.fn().mockRejectedValue(new Error("disk write failed"));

    await expect(
      logoutTool.handler({}, {
        logger,
        manager: { logout },
      } as any),
    ).rejects.toThrow("disk write failed");
  });
});
