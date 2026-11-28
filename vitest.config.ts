import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  resolve: {
    alias: {
      $lib: r('./src/lib'),
      '$env/dynamic/private': r('./test/mocks/env.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    // themes.ts reads dssoca/tokens.css?raw; without this vitest serves CSS imports empty.
    css: true,
    include: ['src/**/*.{test,spec}.{js,ts}', 'test/unit/**/*.{test,spec}.{js,ts}'],
    coverage: { provider: 'v8', include: ['src/lib/**'], reporter: ['text', 'html'] },
  },
})
