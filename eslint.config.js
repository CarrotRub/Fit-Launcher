import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import perfectionist from 'eslint-plugin-perfectionist'

export default defineConfig([
    tseslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], languageOptions: { globals: globals.node },
        plugins: {
            perfectionist,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'perfectionist/sort-objects': ['error', {
                type: 'alphabetical',
            }],
        },
    },
]);
