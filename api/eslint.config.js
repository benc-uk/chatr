import js from '@eslint/js'
import globals from 'globals'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    rules: {
      'prefer-const': 'error',
      'no-unused-vars': [
        'warn',
        {
          caughtErrors: 'none',
        },
      ],
    },
  },
  { files: ['**/*.{js,mjs,cjs}'], languageOptions: { globals: globals.node } },
])
