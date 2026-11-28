// Vitest stand-in for SvelteKit's $app/state: tests set `page.params` / `page.url` directly.
export const page: { params: Record<string, string>; url: URL } = {
  params: {},
  url: new URL('http://localhost/'),
}
