import { AddressType } from "@phantom/client";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

import { PaymentTransactionSchema, payApiAccessTool } from "./pay-api-access";

const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bY";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SPL_TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const TOKEN_TRANSFER = 3;
const TOKEN_TRANSFER_CHECKED = 12;

const FEE_PAYER = new PublicKey("11111111111111111111111111111111");
const DUMMY_BLOCKHASH = "11111111111111111111111111111111";

/** Pre-built valid payment transaction reused across tool-level tests. */
const VALID_PAYMENT_TX = buildTx(splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER));

/** Serialize a set of instructions into a base64-encoded unsigned Solana transaction. */
function buildTx(...ixs: TransactionInstruction[]): string {
  const transaction = new Transaction();

  transaction.feePayer = FEE_PAYER;
  transaction.recentBlockhash = DUMMY_BLOCKHASH;

  ixs.forEach(ix => {
    transaction.add(ix);
  });

  return transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

/** SPL Token Transfer (discriminant 3) or TransferChecked (discriminant 12) instruction. */
function splIx(program: string, discriminant: number): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(program),
    keys: [
      { pubkey: FEE_PAYER, isSigner: false, isWritable: true }, // source
      { pubkey: FEE_PAYER, isSigner: false, isWritable: true }, // destination
      { pubkey: FEE_PAYER, isSigner: true, isWritable: false }, // authority
    ],
    data: Buffer.concat([Buffer.from([discriminant]), Buffer.alloc(8)]), // discriminant + u64 amount
  });
}

/** ATA CreateIdempotent instruction (discriminant 1). */
function ataIx(): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ATA_PROGRAM),
    keys: [
      { pubkey: FEE_PAYER, isSigner: true, isWritable: true },
      { pubkey: FEE_PAYER, isSigner: false, isWritable: true },
      { pubkey: FEE_PAYER, isSigner: false, isWritable: false },
      { pubkey: FEE_PAYER, isSigner: false, isWritable: false },
      { pubkey: FEE_PAYER, isSigner: false, isWritable: false },
      { pubkey: FEE_PAYER, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

jest.mock("@phantom/base64url", () => ({
  base64urlEncode: jest.fn().mockReturnValue("encodedTx"),
}));

const makeContext = (overrides: Record<string, unknown> = {}) => {
  const client = {
    getWalletAddresses: jest.fn().mockResolvedValue([{ addressType: AddressType.solana, address: "So1anaAddress" }]),
    signAndSendTransaction: jest.fn().mockResolvedValue({ hash: "sig123" }),
    ...overrides,
  };
  const session = { walletId: "wallet-1", organizationId: "org-1" };
  return {
    client,
    session,
    apiClient: {
      setPaymentSignature: jest.fn(),
      post: jest.fn().mockResolvedValue({ type: "transaction" as const, block: undefined }),
    },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    manager: { resetSession: jest.fn(), getClient: () => client, getSession: () => session },
  };
};

describe("PaymentTransactionSchema", () => {
  describe("accepts valid transactions", () => {
    it("SPL token Transfer (discriminant 3)", () => {
      const transaction = buildTx(splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER));
      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("SPL token TransferChecked (discriminant 12)", () => {
      const transaction = buildTx(splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER_CHECKED));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("Token-2022 Transfer", () => {
      const transaction = buildTx(splIx(SPL_TOKEN_2022_PROGRAM, TOKEN_TRANSFER));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("Token-2022 TransferChecked", () => {
      const transaction = buildTx(splIx(SPL_TOKEN_2022_PROGRAM, TOKEN_TRANSFER_CHECKED));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("ComputeBudget priority fee + SPL Transfer", () => {
      const transaction = buildTx(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER),
      );

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("multiple SPL transfers", () => {
      const transaction = buildTx(
        splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER),
        splIx(SPL_TOKEN_2022_PROGRAM, TOKEN_TRANSFER),
      );

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("ComputeBudget SetComputeUnitLimit (discriminant 2) + SPL Transfer", () => {
      const transaction = buildTx(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER),
      );

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });

    it("ComputeBudget SetComputeUnitPrice (discriminant 3) + SPL Transfer", () => {
      const transaction = buildTx(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }),
        splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER),
      );

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(true);
    });
  });

  describe("rejects invalid transactions", () => {
    it("random bytes (not a Solana transaction)", () => {
      const transaction = Buffer.from([1, 2, 3]).toString("base64");

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("Payment transaction is not a valid Solana transaction");
    });

    it("SOL transfer via System Program", () => {
      const instruction = SystemProgram.transfer({ fromPubkey: FEE_PAYER, toPubkey: FEE_PAYER, lamports: 1_000_000 });
      const transaction = buildTx(instruction);

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("native SOL payment is forbidden");
    });

    it("ATA program is rejected", () => {
      const transaction = buildTx(ataIx(), splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("unexpected program");
    });

    it("ComputeBudget RequestHeapFrame (discriminant 1) is rejected", () => {
      const heapFrameIx = new TransactionInstruction({
        programId: new PublicKey("ComputeBudget111111111111111111111111111111"),
        keys: [],
        data: Buffer.from([1, 0, 0, 0, 0]), // discriminant=1 (RequestHeapFrame) + u32 bytes
      });
      const transaction = buildTx(heapFrameIx, splIx(SPL_TOKEN_PROGRAM, TOKEN_TRANSFER));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("unexpected ComputeBudget instruction (type 1)");
    });

    it("instruction from an unexpected program", () => {
      const instruction = new TransactionInstruction({
        programId: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC mint — not in allowlist
        keys: [],
        data: Buffer.alloc(1),
      });
      const transaction = buildTx(instruction);

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("unexpected program");
    });

    it("SPL CloseAccount instruction (discriminant 9)", () => {
      const transaction = buildTx(splIx(SPL_TOKEN_PROGRAM, 9));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("unexpected SPL token instruction (type 9)");
    });

    it("transaction with only ComputeBudget (no token transfer)", () => {
      const transaction = buildTx(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("at least one SPL token transfer instruction");
    });

    it("empty transaction (no instructions)", () => {
      const transaction = buildTx();

      const result = PaymentTransactionSchema.safeParse(transaction);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("at least one SPL token transfer instruction");
    });
  });
});

describe("pay_api_access", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("has expected MCP name and required preparedTx", () => {
    expect(payApiAccessTool.name).toBe("pay_api_access");
    expect(payApiAccessTool.inputSchema.required).toContain("preparedTx");
  });

  it("has destructiveHint: true", () => {
    expect(payApiAccessTool.annotations?.destructiveHint).toBe(true);
  });

  it("throws ZodError when preparedTx is missing", async () => {
    const ctx = makeContext();

    await expect(payApiAccessTool.handler({}, ctx as any)).rejects.toMatchObject({
      name: "ZodError",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["preparedTx"], message: expect.stringContaining("expected string") }),
      ]),
    });
  });

  it("throws ZodError when preparedTx decodes to an invalid Solana transaction", async () => {
    const ctx = makeContext();

    await expect(payApiAccessTool.handler({ preparedTx: "!!!" }, ctx as any)).rejects.toMatchObject({
      name: "ZodError",
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("not a valid Solana transaction") }),
      ]),
    });
  });

  it("throws ZodError when preparedTx contains a SOL transfer", async () => {
    const instruction = SystemProgram.transfer({ fromPubkey: FEE_PAYER, toPubkey: FEE_PAYER, lamports: 1_000_000 });
    const transaction = buildTx(instruction);
    const ctx = makeContext();

    await expect(payApiAccessTool.handler({ preparedTx: transaction }, ctx as any)).rejects.toMatchObject({
      name: "ZodError",
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("native SOL payment is forbidden") }),
      ]),
    });
  });

  it("signs payment transaction and stores signature", async () => {
    const ctx = makeContext();
    const result = await payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any);

    expect(ctx.client.getWalletAddresses).toHaveBeenCalledWith("wallet-1", undefined, 0);
    expect(ctx.client.signAndSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: "wallet-1", transaction: "encodedTx", account: "So1anaAddress" }),
    );
    expect(ctx.apiClient.setPaymentSignature).toHaveBeenCalledWith("sig123");
    expect(result).toEqual(expect.objectContaining({ success: true, signature: "sig123" }));
  });

  it("uses walletId and derivationIndex from params when provided", async () => {
    const ctx = makeContext();
    await payApiAccessTool.handler(
      { preparedTx: VALID_PAYMENT_TX, walletId: "wallet-override", derivationIndex: 2 },
      ctx as any,
    );
    expect(ctx.client.getWalletAddresses).toHaveBeenCalledWith("wallet-override", undefined, 2);
    expect(ctx.client.signAndSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: "wallet-override" }),
    );
  });

  it("throws when no Solana address is available", async () => {
    const ctx = makeContext({
      getWalletAddresses: jest.fn().mockResolvedValue([{ addressType: "ethereum", address: "0xabc" }]),
    });
    await expect(payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any)).rejects.toThrow(
      "No Solana address found for this wallet",
    );
  });

  it("throws when signAndSendTransaction returns no hash", async () => {
    const ctx = makeContext({ signAndSendTransaction: jest.fn().mockResolvedValue({ hash: undefined }) });

    await expect(payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any)).rejects.toThrow(
      "Transaction submitted but no signature returned",
    );
  });

  it("runs simulation with the transaction before signing", async () => {
    const ctx = makeContext();

    await payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any);

    expect(ctx.apiClient.post).toHaveBeenCalledWith(
      expect.stringContaining("/simulation/v1"),
      expect.objectContaining({
        type: "transaction",
        params: expect.objectContaining({ transactions: [VALID_PAYMENT_TX] }),
      }),
    );
  });

  it("throws and does not sign when simulation returns a block", async () => {
    const ctx = makeContext();
    ctx.apiClient.post.mockResolvedValue({ type: "transaction", block: { message: "drains all SOL", severity: 1 } });

    await expect(payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any)).rejects.toThrow(
      "Payment transaction blocked by simulation: drains all SOL",
    );
    expect(ctx.client.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it("propagates simulation API errors without signing", async () => {
    const ctx = makeContext();
    ctx.apiClient.post.mockRejectedValue(new Error("network timeout"));

    await expect(payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any)).rejects.toThrow(
      "network timeout",
    );
    expect(ctx.client.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it("proceeds when simulation returns no block", async () => {
    const ctx = makeContext();
    ctx.apiClient.post.mockResolvedValue({ type: "transaction", block: undefined });

    const result = await payApiAccessTool.handler({ preparedTx: VALID_PAYMENT_TX }, ctx as any);

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(ctx.client.signAndSendTransaction).toHaveBeenCalled();
  });
});
