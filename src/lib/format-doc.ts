// The Markdown format spec, shared by the /format help page and the "example" actions on /new.
// docs/markdown-format.md is the single source: the in-app help can never drift from it.

import doc from '../../docs/markdown-format.md?raw'

export const FORMAT_DOC: string = doc

/** The first ```markdown block of the spec: the example deck. */
export const EXAMPLE_MD: string = (/```markdown\r?\n([\s\S]*?)\r?\n```/.exec(doc)?.[1] ?? '') + '\n'

/** A starter for quick create's one-text-box mode (rule: empty line = new slide). */
export const QUICK_EXAMPLE = `My talk
A subtitle under the title

Why this matters
- It saves time
- It looks good on phones

> Simplicity is prerequisite for reliability.
> — Edsger Dijkstra

Thanks!
Questions?`
