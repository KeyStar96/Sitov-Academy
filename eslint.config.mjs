import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Next.js 16 removed `next lint`; ESLint runs directly with this flat config.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React-Compiler rules from eslint-plugin-react-hooks 7. The app does not
    // use the React Compiler; existing hits are tracked as warnings.
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
  {
    // Test doubles and Node scripts legitimately use `any` and `require`.
    files: ['__tests__/**', 'e2e/**', 'jest.setup.ts', 'scripts/**', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react/display-name': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  globalIgnores([
    'supabase/database.types.ts',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'deploy/vps/__pycache__/**',
  ]),
])

export default eslintConfig
