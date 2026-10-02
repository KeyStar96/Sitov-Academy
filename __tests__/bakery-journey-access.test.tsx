import React from 'react'
import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import BakeryJourneyPage from '@/app/[lang]/reise/beim-baecker/page'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))
jest.mock('@/components/journey/BakeryJourney', () => ({
  __esModule: true,
  default: ({ homeHref }: { homeHref: string }) => <div data-testid="bakery-journey">{homeHref}</div>,
}))

const originalNodeEnv = process.env.NODE_ENV
function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, 'NODE_ENV', { value, configurable: true, writable: true })
}

beforeEach(() => {
  jest.clearAllMocks()
  setNodeEnv('development')
})
afterEach(() => setNodeEnv(originalNodeEnv))

test('the German pilot is available in development', async () => {
  render(await BakeryJourneyPage({ params: Promise.resolve({ lang: 'de' }) }))
  expect(screen.getByTestId('bakery-journey')).toHaveTextContent('/de')
  expect(notFound).not.toHaveBeenCalled()
})

test('development still rejects a language outside the German pilot', async () => {
  await expect(BakeryJourneyPage({ params: Promise.resolve({ lang: 'en' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  expect(notFound).toHaveBeenCalledTimes(1)
})

test.each(['production', 'test'])('%s rejects the German pilot', async environment => {
  setNodeEnv(environment)
  await expect(BakeryJourneyPage({ params: Promise.resolve({ lang: 'de' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  expect(notFound).toHaveBeenCalledTimes(1)
})

test.each(['production', 'test'])('%s blocks before resolving route params', async environment => {
  setNodeEnv(environment)
  const resolveParams = jest.fn(() => { throw new Error('Route params must stay unread') })
  const params = { then: resolveParams } as unknown as Promise<{ lang: string }>

  await expect(BakeryJourneyPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  expect(resolveParams).not.toHaveBeenCalled()
  expect(notFound).toHaveBeenCalledTimes(1)
})
