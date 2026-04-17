/**
 * Jest mock for the `incur` package.
 *
 * incur is ESM-only and cannot be required() in a CJS Jest environment.
 * This shim provides:
 *   - `z` re-exported from zod (incur just re-exports zod's z anyway)
 *   - A minimal `Cli` stub so command files that import `Cli.create` don't crash
 *     during unit tests that only care about the `tools` layer.
 */

export { z } from "zod";

type CliInstance = {
  command: (..._args: unknown[]) => CliInstance;
  use: (..._args: unknown[]) => CliInstance;
  serve: () => void;
};

const makeCliInstance = (): CliInstance => {
  const instance: CliInstance = {
    command: () => instance,
    use: () => instance,
    serve: () => {},
  };
  return instance;
};

export const Cli = {
  create: (_name: string, _config?: unknown): CliInstance => makeCliInstance(),
};

export const middleware = {};
