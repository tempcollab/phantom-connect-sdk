/**
 * update_perp_leverage tool
 *
 * Updates leverage and margin type for a perpetual market on Hyperliquid.
 */

import { Cli, z } from "incur";
import { createAction } from "../utils/actions.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletSchema } from "../utils/schemas.js";
import { ActionResponseSchema } from "../utils/output-schemas.js";

const UpdatePerpLeverageSchema = WalletSchema.safeExtend({
  market: z.string().trim().min(1, { message: "market is required" }).describe('Market symbol (e.g. "BTC")'),
  leverage: z.coerce.number().min(1).describe("Leverage multiplier (e.g. 1 for 1x, 10 for 10x)"),
  marginType: z
    .enum(["cross", "isolated"])
    .describe("Margin type: 'cross' shares balance, 'isolated' caps risk per-position"),
});

const updatePerpLeverageAction = createAction({
  description:
    "Updates the leverage and margin type (cross or isolated) for a perpetual market. " +
    "This takes effect for new orders on that market. Cross margin shares account balance across positions; " +
    "isolated margin limits risk to the margin allocated to that position.",
  options: UpdatePerpLeverageSchema,
  output: ActionResponseSchema,
  mcp: {
    command: "update_perp_leverage",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  run: async ({ options: params, var: context }) => {
    const walletId = params.walletId(context.manager);
    const perps = await createPerpsClient(context, walletId, params.derivationIndex);

    context.logger.info(`Updating ${params.market} leverage to ${params.leverage}x ${params.marginType}`);

    return perps.updateLeverage({
      market: params.market,
      leverage: params.leverage,
      marginType: params.marginType,
    });
  },
});

export const perpsLeverageCommand = Cli.create("leverage", updatePerpLeverageAction.command);
export const updatePerpLeverageTool = updatePerpLeverageAction.tool;
