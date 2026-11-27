import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import svelteConfig from './svelte.config.js'

export default tseslint.config(
  {
    ignores: ['build/', '.svelte-kit/', 'coverage/', 'node_modules/', 'agile/', 'static/', 'data/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'], svelteConfig },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Slide text is rendered through sanitizeHtml() (DOMPurify) — see src/lib/deck/render.ts.
      'svelte/no-at-html-tags': 'off',
      // No `paths.base`: plain hrefs are correct here.
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
)
