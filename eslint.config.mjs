import { defineConfig } from "eslint/config"
import tsParser from "@typescript-eslint/parser"

const eslintConfig = defineConfig([
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
])

export default eslintConfig
