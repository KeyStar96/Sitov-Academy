import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { sitovQuestSettings } from './sitov-daily-quest-settings.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
export const sitovQuestSentence = pieces => pieces.join(' ').replace(/\s+([,.;:!?])/g, '$1')

export function buildSitovQuest(level, row, day) {
  const key = `sitov-${level.toLowerCase()}-${row.slug}`
  assert(key.length <= 120)
  const [location, host, imageAlt] = sitovQuestSettings[row.setting]
  const [article, ...noun] = row.words[0].split(' ')
  const word = noun.join(' ')
  assert(word.length <= 160, `${key}: fallback noun too long`)
  // Only the discovery noun is personalized. A template-specific reviewed
  // lexicon prevents a different noun from changing the scene or its grammar.
  const category = `sitov-${level.toLowerCase()}-${hash(key).slice(0, 16)}`
  const forms = { category, word, article, nominative: row.words[0], accusative: `${{ der: 'einen', die: 'eine', das: 'ein' }[article]} ${word}` }
  // IDs identify content, never a solution position. In particular, a student
  // must not be able to hash "option:0" to discover every correct response.
  const occurrences = new Map()
  const pieces = row.pieces.map(text => {
    const occurrence = occurrences.get(text) ?? 0; occurrences.set(text, occurrence + 1)
    return { id: `sitov-p-${hash(`${key}:piece:${text}:${occurrence}`).slice(0, 14)}`, text }
  })
  const options = row.options.map(text => ({ id: `sitov-o-${hash(`${key}:option:${text}`).slice(0, 14)}`, text }))
  const shuffle = (values, salt) => [...values].sort((a, b) => hash(`${key}:${salt}:${a.id}`).localeCompare(hash(`${key}:${salt}:${b.id}`)))
  let bank = shuffle(pieces, 'bank')
  if (bank.every((piece, index) => piece.id === pieces[index].id)) bank = [...bank.slice(1), bank[0]]
  const content = {
    title: row.title, subtitle: row.goal, sitovCatalogDay: day, sitovFocus: row.focus,
    scene: { backgroundKey: `sitov-${row.setting}`, backgroundImage: `/Bilder/deutschreise/sitov-${row.setting}.png`, imageAlt,
      location, audioText: row.intro, speakerId: 'sitov-host',
      characters: [{ id: 'sitov-host', name: host, voice: 'male' }, { id: 'sitov-learner', name: 'Du', voice: 'male' }] },
    steps: [
      { id: 'discover', kind: 'discover', instruction: 'Entdecke die drei Wörter für diese Situation. Tippe jedes Wort an und höre zu.',
        words: row.words.map((text, index) => ({ id: `sitov-w-${index + 1}`, text: index === 0 ? '{{nominative}}' : text, audioText: index === 0 ? '{{nominative}}' : text })) },
      { id: 'build', kind: 'sentence_build', speakerId: 'sitov-learner', prompt: `${row.goal} Setze den Satz zusammen.`, pieces: bank, audioText: sitovQuestSentence(row.pieces) },
      { id: 'dialogue', kind: 'dialogue_choice', speakerId: 'sitov-host', prompt: row.question, audioText: row.intro, options: shuffle(options, 'choices') },
    ],
    completion: { title: 'Deutsch im Alltag geschafft!', text: `Du hast ${location === 'Sitov Academy' ? 'bei der Sitov Academy' : `am Schauplatz ${location}`} Wörter entdeckt, einen Satz gebaut und passend geantwortet.` },
  }
  const accepted = [pieces.map(piece => piece.id), ...(row.alternativeOrders ?? []).map(order => order.map(index => pieces[index].id))]
  const answerKey = { steps: { build: { accepted }, dialogue: { optionId: options[0].id } }, feedback: {
    discover: { correct: 'Gut! Du hast alle drei Wörter entdeckt.', wrong: 'Tippe zuerst jedes der drei Wörter an.' },
    build: { correct: `Der Satz passt. ${row.explanation}`, wrong: `Prüfe die Reihenfolge. Achte auf: ${row.focus}.` },
    dialogue: { correct: `Deine Antwort passt zur Situation. ${row.explanation}`, wrong: 'Achte auf die Frage und die Informationen aus der Szene. Welche Antwort erfüllt das Ziel?' },
  } }
  return { key, level, day, category, forms, content, answerKey }
}
