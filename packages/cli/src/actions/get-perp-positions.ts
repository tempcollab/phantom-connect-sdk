/**
 * get_perp_positions tool
 *
 * Returns open perpetual positions for the authenticated wallet.
 */

import { Cli, z } from "incur";
import { createAction } from "../utils/actions.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "../utils/schemas.js";

const GetPerpPositionsSchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});

const PerpPositionSchema = z.object({
  coin: z.string(),
  direction: z.enum(["long", "short"]),
  size: z.string(),
  margin: z.string(),
  entryPrice: z.string(),
  leverage: z.object({
    type: z.enum(["isolated", "cross", "unknown"]),
    value: z.number(),
  }),
  unrealizedPnl: z.string(),
  liquidationPrice: z.string().nullable(),
});

const GetPerpPositionsOutputSchema = z.array(PerpPositionSchema);
const getPerpPositionsAction = createAction({
  description:
    "Returns all open perpetual positions for the wallet. Each position includes coin, direction (long/short), size, margin, entry price, leverage, unrealized PnL, and liquidation price.",
  options: GetPerpPositionsSchema,
  output: GetPerpPositionsOutputSchema,
  mcp: {
    command: "get_perp_positions",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  run: async ({ options: params, var: context }) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getPositions();
  },
});

export const perpsPositionsCommand = Cli.create("positions", getPerpPositionsAction.command);
export const getPerpPositionsTool = getPerpPositionsAction.tool;
