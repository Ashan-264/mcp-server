import { fixupConfigRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const config = [
    // Flat config only ignores node_modules by default. Without this, `eslint .`
    // walks the generated build output and runs out of memory.
    {
        ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
    },
    ...fixupConfigRules(compat.extends("next/core-web-vitals")),
];

export default config;