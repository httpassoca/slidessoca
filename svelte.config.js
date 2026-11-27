import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
  },
  kit: {
    // One Node process serves the app and the /api routes; runs as a Docker container on the VPS
    // (ADR 0001 in docs/adr). Body limit is raised in the Dockerfile via BODY_SIZE_LIMIT.
    adapter: adapter({ out: 'build' }),
  },
}

export default config
