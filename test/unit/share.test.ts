import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { toasts } from 'dssoca'
import ShareDialog from '$lib/components/ShareDialog.svelte'
import { isLive, publish, ShareError, shareErrorMessage, unpublish } from '$lib/client/share'
import { makeDeck } from '$lib/deck/factory'
import type { Deck, ShareInfo } from '$lib/deck/types'

const DAY = 86_400_000
const info = (over: Partial<ShareInfo> = {}): ShareInfo => ({
  id: 'abcdefghij',
  token: 'secret-token',
  expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
  publishedAt: new Date().toISOString(),
  ...over,
})

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  toasts.clear()
})

describe('share client', () => {
  it('publishes with POST and never uploads the edit token', async () => {
    fetchMock.mockResolvedValueOnce(json(201, info()))
    const deck = makeDeck('Talk')
    const out = await publish(deck)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/decks')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).deck.title).toBe('Talk')
    expect(out.share?.id).toBe('abcdefghij')
  })

  it('republishes with PUT + Bearer and strips share from the body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, info()))
    await publish({ ...makeDeck(), share: info() })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/decks/abcdefghij')
    expect(init.method).toBe('PUT')
    expect(init.headers.authorization).toBe('Bearer secret-token')
    expect(init.body).not.toContain('secret-token')
  })

  it('falls back to a new link when the old one is gone (404)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(404, { message: 'This shared deck does not exist' }))
      .mockResolvedValueOnce(json(201, info({ id: 'NEWNEWNEW1' })))
    const out = await publish({ ...makeDeck(), share: info() })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/decks')
    expect(out.share?.id).toBe('NEWNEWNEW1')
  })

  it('surfaces status codes as ShareError', async () => {
    fetchMock.mockResolvedValueOnce(json(413, { message: 'Deck is too large.' }))
    const err = await publish(makeDeck()).catch((e) => e)
    expect(err).toBeInstanceOf(ShareError)
    expect(err.status).toBe(413)
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    expect((await publish(makeDeck()).catch((e) => e)).status).toBe(0)
  })

  it('unpublishes with DELETE and forgets the share', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const out = await unpublish({ ...makeDeck(), share: info() })
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    expect(out.share).toBeUndefined()
  })

  it('maps errors to clear messages', () => {
    expect(shareErrorMessage(new ShareError(413, 'x'))).toMatch(/too large/i)
    expect(shareErrorMessage(new ShareError(429, 'x'))).toMatch(/hour/i)
    expect(shareErrorMessage(new ShareError(507, 'x'))).toMatch(/storage/i)
    expect(shareErrorMessage(new ShareError(0, 'x'))).toMatch(/connection/i)
    expect(shareErrorMessage(new ShareError(400, 'Bad deck'))).toBe('Bad deck')
  })

  it('knows when a link is live', () => {
    expect(isLive(undefined)).toBe(false)
    expect(isLive(info())).toBe(true)
    expect(isLive(info({ expiresAt: new Date(Date.now() - DAY).toISOString() }))).toBe(false)
  })
})

describe('ShareDialog', () => {
  function mount(deck: Deck) {
    const onchange = vi.fn()
    render(ShareDialog, { props: { open: true, deck, onchange } })
    return onchange
  }

  it('publishes an unshared deck and reports the new share', async () => {
    fetchMock.mockResolvedValueOnce(json(201, info()))
    const onchange = mount(makeDeck('Talk'))
    expect(screen.getByText(/for/).textContent).toMatch(/30 days/)
    await fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(onchange).toHaveBeenCalledOnce())
    expect(onchange.mock.calls[0][0].share.id).toBe('abcdefghij')
  })

  it('shows the link, expiry and republish / unpublish for a shared deck', async () => {
    const share = info({ expiresAt: '2026-12-27T12:00:00.000Z' })
    const onchange = mount({ ...makeDeck('Talk'), share })
    const input = screen.getByLabelText('Public link') as HTMLInputElement
    expect(input.value).toBe(`${location.origin}/s/abcdefghij`)
    expect(screen.getByText(/Available until/).textContent).toMatch(/2026/)
    expect(screen.getByText(/30 days after the last publish/)).toBeInTheDocument()

    fetchMock.mockResolvedValueOnce(json(200, info({ publishedAt: 'later' })))
    await fireEvent.click(screen.getByRole('button', { name: 'Republish' }))
    await waitFor(() => expect(onchange).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
  })

  it('asks before unpublishing', async () => {
    const onchange = mount({ ...makeDeck('Talk'), share: info() })
    await fireEvent.click(screen.getByRole('button', { name: 'Unpublish…' }))
    expect(screen.getByText(/stops working for everyone/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    await waitFor(() => expect(onchange).toHaveBeenCalledOnce())
    expect(onchange.mock.calls[0][0].share).toBeUndefined()
  })

  it('shows a clear error when the deck is too large', async () => {
    fetchMock.mockResolvedValueOnce(json(413, { message: 'Deck is too large.' }))
    const onchange = mount(makeDeck('Huge'))
    await fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/15 MB/)
    expect(onchange).not.toHaveBeenCalled()
    expect(toasts.items.some((t) => t.kind === 'error')).toBe(true)
  })

  it('offers to publish again when the link expired', () => {
    mount({ ...makeDeck(), share: info({ expiresAt: new Date(Date.now() - DAY).toISOString() }) })
    expect(screen.getByText('Link expired')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mount({ ...makeDeck(), share: info() })
    await fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/s/abcdefghij`)
  })
})
