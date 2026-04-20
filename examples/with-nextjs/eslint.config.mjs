import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-disable-next-line import/no-anonymous-default-export
export default [
  ...coreWebVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react v7.37.5 calls context.getFilename() (removed in ESLint v10)
    // when react.version is "detect". Pin explicitly to skip auto-detection.
    settings: {
      react: { version: "19" },
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];
