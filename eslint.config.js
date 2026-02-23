import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "dist-electron", "node_modules", ".trae"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/renderer/**/*.ts", "src/renderer/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  },
  {
    files: ["src/main/**/*.ts", "src/preload/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
);
