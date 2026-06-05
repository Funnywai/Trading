import { defineConfig } from "eslint/config";

const eslintConfig = defineConfig([
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
