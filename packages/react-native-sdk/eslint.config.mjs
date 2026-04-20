import baseConfig from "../../eslint.shared.mjs";
import reactPlugin from "eslint-plugin-react";

export default [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: {
        version: "19.0.0",
      },
    },
    rules: {
      "no-console": ["warn", { allow: ["error", "warn", "info", "log"] }],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
    },
  },
];
