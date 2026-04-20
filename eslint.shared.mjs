import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import securityPlugin from "eslint-plugin-security";
import importPlugin from "eslint-plugin-import";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import checkFilePlugin from "eslint-plugin-check-file";
import prettierConfig from "eslint-config-prettier";

// Collect all rules from the flat/recommended array (avoids the global-parser-setup entry)
const tsRecommendedRules = tsPlugin.configs["flat/recommended"].reduce(
  (acc, config) => ({ ...acc, ...(config.rules ?? {}) }),
  {},
);

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/jest.config.js",
      "sharedJestConfig.js",
      "**/__fixtures__/**",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/vite.config.ts",
      "**/vite-env.d.ts",
      "**/tsup.config.ts",
      "**/tsup.config.mts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "check-file": checkFilePlugin,
      import: importPlugin,
      "react-hooks": reactHooksPlugin,
      security: securityPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import/resolver": { typescript: true },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx", ".mts", ".cts"],
      },
    },
    rules: {
      ...tsRecommendedRules,
      ...securityPlugin.configs.recommended.rules,
      "no-console": ["error", { allow: ["error"] }],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/consistent-type-exports": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "import/no-duplicates": "error",
      "@typescript-eslint/no-inferrable-types": "off",
      "prefer-const": ["error", { destructuring: "all" }],
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "**/*.test.*",
            "**/__test__/**",
            "**/__tests__/**",
            "**/testUtils.*",
            "**/e2e/**",
            "**/__mocks__/**",
            "**/vite.config.mts",
            "**/jestSetup.ts",
            "**/tsup.config.ts",
          ],
          includeTypes: false,
        },
      ],
      "check-file/folder-naming-convention": ["error", { "src/**/!(__tests__|__fixtures__|__mocks__)": "KEBAB_CASE" }],
      "security/detect-unsafe-regex": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-object-injection": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-return-await": "off",
      "@typescript-eslint/return-await": "off",
      "@typescript-eslint/no-for-in-array": "error",
      "require-await": "off",
      "@typescript-eslint/require-await": "error",
      "import/no-cycle": ["error", { maxDepth: 50 }],
    },
  },
  prettierConfig,
  {
    files: ["packages/parsers/**/*.ts", "packages/constants/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-exports": "off",
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  {
    files: ["packages/ui/**/*.native.ts", "packages/ui/**/*.native.tsx"],
    rules: {
      "import/no-extraneous-dependencies": [
        "error",
        { devDependencies: true, optionalDependencies: false, peerDependencies: true },
      ],
    },
  },
];

export default config;
