import parser from '@typescript-eslint/parser'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser,
    },
  },
  prettierRecommended,
]
