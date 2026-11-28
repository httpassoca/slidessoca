// Vitest stand-in for SvelteKit's $app/navigation (tests spy on these with vi.mock).
export const goto = async (_url: string): Promise<void> => {}
export const replaceState = (_url: string, _state: unknown): void => {}
export const afterNavigate = (_fn: () => void): void => {}
