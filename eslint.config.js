import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'tests/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '.conda/**', 'node_modules/**', 'Backend/**'] },
  {
    extends: [...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Tillåt any i API responses - dessa kommer från backend och är svåra att typa exakt
      '@typescript-eslint/no-explicit-any': 'warn',
      // Tillåt unused vars med underscore prefix, och tillåt 'error' i catch
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^error$|^err$|^e$'
      }],
      // Tillåt require i test-filer
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
)
