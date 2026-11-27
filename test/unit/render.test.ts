import { describe, expect, it } from 'vitest'
import { markdownToSafeHtml, renderMarkdown } from '$lib/deck/render'

// markdownToSafeHtml is the no-DOM path the SSR viewer uses; renderMarkdown adds DOMPurify in
// the browser (jsdom here). Both must be safe on their own.
const parse = (html: string) => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

describe.each([
  ['markdownToSafeHtml (server)', markdownToSafeHtml],
  ['renderMarkdown (browser)', renderMarkdown],
])('%s', (_name, render) => {
  it('renders real formatting', () => {
    const html = render('Hello **bold** and *em*\n\n- one\n- two')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
  })

  it('keeps ordered list start and safe links', () => {
    expect(render('3. three\n4. four')).toContain('<ol start="3">')
    const html = render('[site](https://example.com "Example")')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('title="Example"')
  })

  it('never lets raw HTML through', () => {
    const html = render(
      '<script>alert(1)</script><img src=x onerror=alert(1)> <b onclick="x">b</b>',
    )
    expect(parse(html).querySelector('script, img, [onerror], [onclick]')).toBeNull()
    expect(parse(html).textContent).toContain('<script>')
  })

  it('drops javascript: and data: links but keeps the text', () => {
    const html = render('[click](javascript:alert(1)) [d](data:text/html,hi)')
    expect(html).not.toMatch(/javascript:|data:text/i)
    expect(html).toContain('click')
    expect(html).not.toContain('<a')
  })

  it('renders Markdown images as their alt text only', () => {
    const html = render('![a cat](https://example.com/cat.png)')
    expect(html).not.toContain('<img')
    expect(html).toContain('a cat')
  })

  it('drops tags outside the allowlist (tables, hr, h5)', () => {
    const html = render('| a | b |\n|---|---|\n| 1 | 2 |\n\n---\n\n##### small')
    expect(html).not.toMatch(/<table|<td|<hr|<h5/)
    expect(html).toContain('small')
  })

  it('escapes code and keeps line breaks', () => {
    expect(render('`<b>`')).toContain('<code>&lt;b&gt;</code>')
    expect(render('a\nb')).toContain('<br>')
  })
})

describe('markdownToSafeHtml attribute handling', () => {
  it('escapes quotes in link titles', () => {
    const html = markdownToSafeHtml('[x](https://e.com "a&quot; onmouseover=&quot;b")')
    const a = parse(html).querySelector('a')!
    expect(a.getAttributeNames().sort()).toEqual(['href', 'title'])
  })

  it('renders task list checkboxes as text, not inputs', () => {
    const html = markdownToSafeHtml('- [x] done\n- [ ] todo')
    expect(html).not.toContain('<input')
    expect(html).toContain('☑')
  })
})
