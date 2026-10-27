import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "data/", "coverage/", ".autobuild/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "scripts/**/*.js", "tests/**/*.js", "e2e/**/*.mjs", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.node },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error"] }],
      eqeqeq: "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "prefer-const": "error",
    },
  },
  { files: ["scripts/**/*.js", "e2e/**/*.mjs"], rules: { "no-console": "off" } },
  // e2e code passes callbacks into the browser via page.evaluate()
  { files: ["e2e/**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ["public/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.browser },
    rules: { "no-unused-vars": "error", eqeqeq: "error", "no-eval": "error" },
  },
];
