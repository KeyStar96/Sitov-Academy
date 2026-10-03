import { sitovPronunciationConversationTitle } from '@/lib/sitov-pronunciation-legacy-title'
import revisions from '@/supabase/seeds/sitov-pronunciation-revisions-2026.json'

it('retains the original title only for the exact original recorded text', () => {
  const row = revisions.find(value => value.oldTitle !== value.title)!
  expect(sitovPronunciationConversationTitle(row.id, row.oldText, row.title)).toBe(row.oldTitle)
  expect(sitovPronunciationConversationTitle(row.id, row.text, row.title)).toBe(row.title)
  expect(sitovPronunciationConversationTitle(row.id, 'Ein individuell bearbeiteter Text.', 'Eigenes Beispiel')).toBe('Eigenes Beispiel')
  expect(sitovPronunciationConversationTitle(null, row.oldText, null)).toBeNull()
})
