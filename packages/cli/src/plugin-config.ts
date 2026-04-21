import { z } from "zod";

const TrimmedStringSchema = z.string().trim().min(1).optional().catch(undefined);

const PortSchema = z.coerce.number().int().min(1).max(65535).optional().catch(undefined);

export const PluginConfigSchema = z.object({
  PHANTOM_AUTH_BASE_URL: TrimmedStringSchema,
  PHANTOM_CONNECT_BASE_URL: TrimmedStringSchema,
  PHANTOM_WALLETS_API_BASE_URL: TrimmedStringSchema,
  PHANTOM_API_BASE_URL: TrimmedStringSchema,
  PHANTOM_VERSION: TrimmedStringSchema,
  PHANTOM_CALLBACK_PORT: PortSchema,
  PHANTOM_CALLBACK_PATH: TrimmedStringSchema,
  PHANTOM_MCP_DEBUG: TrimmedStringSchema,
  PHANTOM_APP_ID: TrimmedStringSchema,
  PHANTOM_CLIENT_ID: TrimmedStringSchema,
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

export const PluginConfigJsonSchema = z.toJSONSchema(PluginConfigSchema);
