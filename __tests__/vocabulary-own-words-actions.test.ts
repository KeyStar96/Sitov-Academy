jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { addOwnWord, deleteOwnWord, getVocabularyAssessment } from '@/app/actions/vocabulary'

const userId = '00000000-0000-4000-8000-000000000001'
const cardId = '30000000-0000-4000-8000-000000000001'

function setup(rpcResult: unknown = { data: { cardId, activated: false }, error: null }) {
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: {
    role: 'student', level_access: [{ level: 'A1.1' }], native_language: 'ru', ui_language: 'ru', trainer_grants: [],
  }, error: null }) }
  const rulesResult = Promise.resolve({ data: [], error: null })
  const rules = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: rulesResult.then.bind(rulesResult) }
  const from = jest.fn((table: string) => table === 'profiles' ? profile : rules)
  const rpc = jest.fn().mockResolvedValue(rpcResult)
  jest.mocked(createClient).mockResolvedValue({ from, rpc, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) } } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, rpc }
}

beforeEach(() => jest.clearAllMocks())

it('trennt den Artikel ab und trägt das Wort in der Sprache der Oberfläche ein', async () => {
  const { rpc } = setup()
  expect(await addOwnWord({ level: 'A1.1', word: '  das   Brot ', translation: ' хлеб ', uiLanguage: 'ru' }))
    .toEqual({ success: true, cardId, activated: false })
  expect(rpc).toHaveBeenCalledWith('add_own_vocabulary', { p_level: 'A1.1', p_word_de: 'Brot', p_article: 'das', p_translation: 'хлеб', p_locale: 'ru' })
})

it.each([
  ['own_word_exists', 'exists'],
  ['own_word_limit', 'limit'],
  ['invalid_input', 'invalid'],
  ['trainer_access_denied', 'failed'],
] as const)('übersetzt den Datenbankfehler %s in %s', async (code, error) => {
  setup({ data: { error: code, message: 'x', sqlstate: '22023' }, error: null })
  expect(await addOwnWord({ level: 'A1.1', word: 'Brot', translation: 'хлеб', uiLanguage: 'ru' })).toEqual({ success: false, error })
})

it('lehnt leere Felder und die deutsche Oberfläche ab, ohne die Datenbank zu fragen', async () => {
  const { rpc } = setup()
  expect(await addOwnWord({ level: 'A1.1', word: '   ', translation: 'хлеб', uiLanguage: 'ru' })).toEqual({ success: false, error: 'invalid' })
  expect(await addOwnWord({ level: 'A1.1', word: 'Brot', translation: 'Brot', uiLanguage: 'de' })).toEqual({ success: false, error: 'invalid' })
  expect(rpc).not.toHaveBeenCalled()
})

it('löscht nur mit gültiger Karten-ID', async () => {
  const { rpc } = setup({ data: { success: true }, error: null })
  expect(await deleteOwnWord('kein-uuid')).toEqual({ success: false })
  expect(rpc).not.toHaveBeenCalled()
  expect(await deleteOwnWord(cardId)).toEqual({ success: true })
  expect(rpc).toHaveBeenCalledWith('delete_own_vocabulary', { p_card_id: cardId })
})

it('bietet für eigene Wörter keine Einstufung an', async () => {
  const { from } = setup()
  expect(await getVocabularyAssessment('Eigene Wörter', 'A1.1', 'ru')).toEqual({ learnerId: null, cards: [] })
  expect(from).not.toHaveBeenCalled()
})
