import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  // Base JS recommended rules
  js.configs.recommended,

  // React files
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React recommended
      ...reactPlugin.configs.recommended.rules,

      // Hooks rules
      ...reactHooks.configs.recommended.rules,

      // React Refresh (Vite HMR)
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // React 17+ — no need to import React in scope
      "react/react-in-jsx-scope": "off",

      // Plain JS project — PropTypes would duplicate TS effort; skip it
      "react/prop-types": "off",

      // Code quality
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      // Allow == null / != null (catches both null and undefined — idiomatic JS)
      "eqeqeq": ["error", "always", { null: "ignore" }],
    },
  },

  // Test files (looser rules)
  {
    files: ["**/*.test.{js,jsx}", "**/*.spec.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Ignore patterns
  {
    ignores: ["dist/", "node_modules/", "vite.config.js"],
  },
];
