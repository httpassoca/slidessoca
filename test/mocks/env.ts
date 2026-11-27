// Vitest stand-in for SvelteKit's $env/dynamic/private: the real process env.
export const env: Record<string, string | undefined> = process.env
