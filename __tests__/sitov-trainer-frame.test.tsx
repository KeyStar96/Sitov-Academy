import { fireEvent, render, screen } from '@testing-library/react'
import LearningScreen, { scrollLearningWorkspace } from '@/components/vocabulary/LearningScreen'
jest.unmock('lucide-react')

it('keeps the shared navigation interactive and document scrolling available during practice', () => {
  const navigate = jest.fn()
  const exit = jest.fn()
  document.body.style.overflow = ''
  render(<><header><button onClick={navigate}>Learning path</button></header>
    <LearningScreen title="Practice" progress={25} onExit={exit} t={() => 'Back'}><button>Check answer</button></LearningScreen>
  </>)
  expect(document.body.style.overflow).toBe('')
  expect(screen.getByRole('button', { name: 'Learning path' }).closest('[inert]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Learning path' }))
  expect(navigate).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(exit).toHaveBeenCalledTimes(1)
})

it('returns document-flow tasks to their frame instead of a non-scrolling workspace', () => {
  const frame = document.createElement('section')
  frame.className = 'learning-screen'
  frame.dataset.presentation = 'embedded'
  const workspace = document.createElement('div')
  frame.append(workspace)
  frame.scrollIntoView = jest.fn()
  workspace.scrollTo = jest.fn()
  scrollLearningWorkspace(workspace)
  expect(frame.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  expect(workspace.scrollTo).not.toHaveBeenCalled()
  frame.dataset.presentation = 'fullscreen'
  scrollLearningWorkspace(workspace)
  expect(workspace.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
})
