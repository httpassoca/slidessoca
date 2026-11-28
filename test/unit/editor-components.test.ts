import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import SlideSorter from '$lib/components/editor/SlideSorter.svelte'
import EditorCanvas from '$lib/components/editor/EditorCanvas.svelte'
import Inspector from '$lib/components/editor/Inspector.svelte'
import { makeSlide } from '$lib/deck/factory'
import type { Slide } from '$lib/deck/types'

const slides = [makeSlide({ title: 'A' }), makeSlide({ title: 'B' }), makeSlide({ title: 'C' })]

describe('SlideSorter', () => {
  const setup = () => {
    const props = {
      slides,
      theme: 'dark' as const,
      current: 1,
      onselect: vi.fn(),
      onadd: vi.fn(),
      onduplicate: vi.fn(),
      ondelete: vi.fn(),
      onmove: vi.fn(),
    }
    render(SlideSorter, props)
    return props
  }

  it('lists slides with roving focus on the current one', () => {
    setup()
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(3)
    expect(opts[1]).toHaveAttribute('aria-selected', 'true')
    expect(opts[1]).toHaveAttribute('tabindex', '0')
    expect(opts[0]).toHaveAttribute('tabindex', '-1')
  })

  it('arrows select, Alt+arrows reorder, Delete deletes, Ctrl+D duplicates', async () => {
    const p = setup()
    const cur = screen.getAllByRole('option')[1]
    await fireEvent.keyDown(cur, { key: 'ArrowDown' })
    expect(p.onselect).toHaveBeenCalledWith(2)
    await fireEvent.keyDown(cur, { key: 'ArrowUp', altKey: true })
    expect(p.onmove).toHaveBeenCalledWith(1, 0)
    await fireEvent.keyDown(cur, { key: 'Delete' })
    expect(p.ondelete).toHaveBeenCalledWith(1)
    await fireEvent.keyDown(cur, { key: 'd', ctrlKey: true })
    expect(p.onduplicate).toHaveBeenCalledWith(1)
  })

  it('current-slide buttons act on the current slide', async () => {
    const p = setup()
    await fireEvent.click(screen.getByRole('button', { name: 'Move slide later' }))
    expect(p.onmove).toHaveBeenCalledWith(1, 2)
    await fireEvent.click(screen.getByRole('button', { name: 'Duplicate slide' }))
    expect(p.onduplicate).toHaveBeenCalledWith(1)
  })
})

describe('EditorCanvas', () => {
  const slide: Slide = makeSlide({ title: 'Hello', body: '- one' })
  const setup = (over: Partial<Record<string, unknown>> = {}) => {
    const props = {
      slide,
      theme: 'dark' as const,
      label: 'Slide 1 of 1',
      selectedId: null as string | null,
      editingId: null as string | null,
      onselect: vi.fn(),
      onbox: vi.fn(),
      ongestureend: vi.fn(),
      onedit: vi.fn(),
      ontext: vi.fn(),
      onkey: vi.fn(),
      ondropdata: vi.fn(),
      ...over,
    }
    render(EditorCanvas, props)
    return props
  }

  it('renders a focusable hit target per element; focus selects', async () => {
    const p = setup()
    const hits = screen.getAllByRole('button', { name: /box:/ })
    expect(hits).toHaveLength(2)
    await fireEvent.focus(hits[0])
    expect(p.onselect).toHaveBeenCalledWith(slide.elements[0].id)
  })

  it('Enter on a text element starts inline editing; other keys go to onkey', async () => {
    const p = setup({ selectedId: slide.elements[0].id })
    const hit = screen.getAllByRole('button', { name: /box:/ })[0]
    await fireEvent.keyDown(hit, { key: 'Enter' })
    expect(p.onedit).toHaveBeenCalledWith(slide.elements[0].id)
    await fireEvent.keyDown(hit, { key: 'ArrowLeft' })
    expect(p.onkey).toHaveBeenCalled()
  })

  it('shows 8 resize handles for the selection and an inline editor while editing', () => {
    const id = slide.elements[0].id
    const { container } = render(EditorCanvas, {
      slide,
      theme: 'dark',
      label: 'x',
      selectedId: id,
      editingId: null,
      onselect: vi.fn(),
      onbox: vi.fn(),
      ongestureend: vi.fn(),
      onedit: vi.fn(),
      ontext: vi.fn(),
      onkey: vi.fn(),
      ondropdata: vi.fn(),
    })
    expect(container.querySelectorAll('.selection .handle')).toHaveLength(8)
  })

  it('typing in the inline editor reports the Markdown text', async () => {
    const id = slide.elements[0].id
    const p = setup({ selectedId: id, editingId: id })
    const ta = screen.getByRole('textbox', { name: /Edit title/ })
    await fireEvent.input(ta, { target: { value: 'New title' } })
    expect(p.ontext).toHaveBeenCalledWith(id, 'New title')
  })
})

describe('Inspector', () => {
  it('edits notes and the content form through onslide', async () => {
    const slide = makeSlide({ title: 'T' })
    const onslide = vi.fn()
    render(Inspector, {
      slide,
      element: undefined,
      theme: 'dark',
      onslide,
    })
    await fireEvent.input(screen.getByLabelText('Notes'), { target: { value: 'say hi' } })
    const [fn, group] = onslide.mock.calls.at(-1)!
    expect(fn(slide).notes).toBe('say hi')
    expect(group).toBe(`notes-${slide.id}`)
    await fireEvent.input(screen.getByLabelText('Subtitle'), { target: { value: 'Sub' } })
    const next = onslide.mock.calls.at(-1)![0](slide) as Slide
    expect(next.content.subtitle).toBe('Sub')
    expect(next.elements.some((e) => e.kind === 'text' && e.role === 'subtitle')).toBe(true)
  })

  it('shows element controls for a selected text box', () => {
    const slide = makeSlide({ title: 'T' })
    render(Inspector, {
      slide,
      element: slide.elements[0],
      theme: 'dark',
      onslide: vi.fn(),
    })
    expect(screen.getByRole('button', { name: 'Delete element' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Colour' })).toBeInTheDocument()
  })
})
