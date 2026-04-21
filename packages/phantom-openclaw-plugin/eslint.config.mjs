import baseConfig from "../../eslint.shared.mjs";

export default [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: "Do not use process.env — pass config explicitly.",
        },
      ],
    },
  },
];
