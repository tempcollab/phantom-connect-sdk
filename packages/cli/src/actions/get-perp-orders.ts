/**
 * get_perp_orders tool
 *
 * Returns open perpetual orders for the authenticated wallet.
 */

import { Cli, z } from "incur";
import { createAction } from "../utils/actions.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletSchema } from "../utils/schemas.js";

const GetPerpOrdersSchema = WalletSchema;

const PerpOrderSchema = z.object({
  id: z.string(),
  coin: z.string(),
  side: z.enum(["long", "short"]),
  type: z.enum(["limit", "take_profit_market", "stop_market"]),
  isTrigger: z.boolean(),
  limitPrice: z.string(),
  triggerPrice: z.string().optional(),
  size: z.string(),
  reduceOnly: z.boolean(),
  timestamp: z.number(),
});

const GetPerpOrdersOutputSchema = z.array(PerpOrderSchema);

const getPerpOrdersAction = createAction({
  description:
    "Returns all open perpetual orders (limit orders, take-profit, stop-loss) for the wallet. Each order includes ID, coin, side, type, limit/trigger price, size, and whether it is reduce-only.",
  options: GetPerpOrdersSchema,
  output: GetPerpOrdersOutputSchema,
  mcp: {
    command: "get_perp_orders",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  run: async ({ options: params, var: context }) => {
    const walletId = params.walletId(context.manager);

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getOpenOrders();
  },
});

export const perpsOrdersCommand = Cli.create("orders", getPerpOrdersAction.command);
export const getPerpOrdersTool = getPerpOrdersAction.tool;
