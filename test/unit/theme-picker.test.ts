import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import ThemePicker from '$lib/components/ThemePicker.svelte'
import SlideGrid from '$lib/components/SlideGrid.svelte'
import { THEMES } from '$lib/themes'
import { blocksToSlides } from '$lib/deck/quick'

describe('ThemePicker', () => {
  it('offers every theme, painted by the theme itself', () => {
    const { container } = render(ThemePicker, { value: 'dark' })
    expect(screen.getAllByRole('radio')).toHaveLength(THEMES.length)
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    expect(container.querySelector('[data-palette="nord"]')).not.toBeNull()
  })

  it('picks on click and with arrow keys', async () => {
    const onchange = vi.fn()
    render(ThemePicker, { value: 'dark', onchange })
    await fireEvent.click(screen.getByRole('radio', { name: 'Nord' }))
    expect(onchange).toHaveBeenLastCalledWith('nord')
    expect(screen.getByRole('radio', { name: 'Nord' })).toHaveAttribute('aria-checked', 'true')
    await fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    const next = THEMES[THEMES.findIndex((t) => t.id === 'nord') + 1]
    expect(onchange).toHaveBeenLastCalledWith(next.id)
  })
})

describe('SlideGrid', () => {
  it('renders one numbered thumbnail per slide', () => {
    const slides = blocksToSlides([
      { title: 'One', text: 'sub', images: [] },
      { title: 'Two', text: '- a', images: [] },
    ])
    const { container } = render(SlideGrid, { slides, theme: 'light' })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(container.querySelectorAll('.slide[data-theme="light"]')).toHaveLength(2)
    expect(screen.getByText('Two', { selector: '.meta' })).toBeInTheDocument()
  })
})
