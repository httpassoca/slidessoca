// Decks live in IndexedDB, so every page except the shared viewer (/s/[id], SSR for link
// previews) renders on the client.
export const ssr = false
