import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Hidden directories ('.*/**') can hold local scratch copies of src/ (git
  // worktrees, editor tooling). Without this every lint run scanned the repo
  // two or more times and reported the same warning once per copy.
  { ignores: ['dist', 'tests/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '.conda/**', 'node_modules/**', 'Backend/**', '.*/**'] },
  // Disable all rules for files with phantom errors
  {
    files: ['src/features/shared/FeatureErrorBoundary.tsx', 'src/hooks/useErrorRecovery.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
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
      // React Compiler advisories from react-hooks 7, kept visible as warnings.
      // set-state-in-effect flags data loading that sets state from an effect,
      // the pattern most screens here use; moving it to a query layer is a
      // refactor per screen, not a lint fix. preserve-manual-memoization only
      // reports where the compiler would skip optimising.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
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
  {
    files: [
      'src/components/Accessibility/ScreenReader.tsx',
      'src/components/Accessibility/SkipLink.tsx',
      'src/components/PremiumGate.tsx',
      'src/components/WellnessHub.tsx',
      'src/components/ui/tailwind.tsx',
      'src/contexts/AuthContext.tsx',
      'src/contexts/SubscriptionContext.tsx',
      'src/contexts/ThemeContext.tsx',
      'src/features/shared/FeatureErrorBoundary.tsx',
      'src/main.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
