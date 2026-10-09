import { act } from '@testing-library/react'
import { createElement } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server.node'
import Script from 'next/script'
import { HeadManagerContext } from 'next/dist/shared/lib/head-manager-context.shared-runtime'
import { SitovDocumentBootstrap } from '@/components/layout/SitovDocumentBootstrap'
import { CONSENT_BOOTSTRAP_SCRIPT } from '@/lib/analytics/consent'
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme'

// Exercise the installed Next Script implementation, including its app queue.
const bootstrap = () => <>
  {createElement(Script, { id: 'sitov-theme-bootstrap', strategy: 'beforeInteractive', dangerouslySetInnerHTML: { __html: THEME_BOOTSTRAP_SCRIPT } })}
  {createElement(Script, { id: 'sitov-consent-bootstrap', strategy: 'beforeInteractive', dangerouslySetInnerHTML: { __html: CONSENT_BOOTSTRAP_SCRIPT } })}
</>
const initialDocument = () => <HeadManagerContext.Provider value={{ appDir: true }}>
  <SitovDocumentBootstrap>{bootstrap()}</SitovDocumentBootstrap>
</HeadManagerContext.Provider>

it('keeps both exact bootstrap sources in the initial server HTML, in order', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(initialDocument())
  const scripts = [...container.querySelectorAll('script')]
  expect(scripts).toHaveLength(2)
  const enqueue = jest.fn()
  for (const script of scripts) new Function('self', script.textContent ?? '')({ __next_s: { push: enqueue } })
  expect(enqueue.mock.calls).toEqual([
    [[0, { children: THEME_BOOTSTRAP_SCRIPT, id: 'sitov-theme-bootstrap' }]],
    [[0, { children: CONSENT_BOOTSTRAP_SCRIPT, id: 'sitov-consent-bootstrap' }]],
  ])
})

it('hydrates matching server scripts without a recoverable error or inert client script', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(initialDocument())
  document.body.append(container)
  const recoverable = jest.fn()
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => { root = hydrateRoot(container, initialDocument(), { onRecoverableError: recoverable }) })
    expect(recoverable).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(container.querySelector('script')).toBeNull()
  } finally {
    await act(async () => { root?.unmount() })
    container.remove()
    errors.mockRestore()
  }
})

it('does not insert or rerun bootstrap on a client locale mount or remount', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  const root = createRoot(container)
  document.documentElement.dataset.theme = 'dark'
  document.documentElement.dataset.consent = 'set'
  try {
    for (const lang of ['ru', 'de', 'en', 'uk', 'tr']) {
      await act(async () => { root.render(<HeadManagerContext.Provider value={{ appDir: true }}>
        <SitovDocumentBootstrap key={lang}>{bootstrap()}</SitovDocumentBootstrap>
      </HeadManagerContext.Provider>) })
      expect(container.querySelector('script')).toBeNull()
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(document.documentElement.dataset.consent).toBe('set')
    }
    expect(errors).not.toHaveBeenCalled()
  } finally {
    await act(async () => { root.unmount() })
    container.remove()
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.consent
    errors.mockRestore()
  }
})
