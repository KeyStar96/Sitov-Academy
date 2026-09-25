import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { STUDENT_MESSAGES } from '@/lib/student-ui-i18n'

/**
 * Phase 2.3: Die Vokabel-Lektionen heißen „Lektionen". „Lernweg" gibt es in
 * keinem Oberflächentext mehr, und die fremdsprachigen Wörter für
 * „Lernpfad" (learning path, учебный путь, навчальний шлях, öğrenme yolu)
 * sind ausschließlich dem Grammatik-Lernpfad vorbehalten: Sie dürfen nur
 * dort stehen, wo der deutsche Text „Lernpfad" sagt.
 */
const PATH_TERMS: Record<string, RegExp> = {
  en: /learning path/i,
  ru: /учебн\S*\s+пут/i,
  uk: /навчальн\S*\s+шлях/i,
  tr: /öğrenme\s+yol/i,
}

type Tree = { [key: string]: string | Tree }
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(out, flatten(value as Tree, path))
  }
  return out
}

const dictionaries = Object.fromEntries(['de', 'en', 'ru', 'uk', 'tr'].map(lang =>
  [lang, flatten(JSON.parse(readFileSync(resolve(process.cwd(), `dictionaries/${lang}.json`), 'utf8')))]))

it('kein Oberflächentext in dictionaries/ und lib/*-i18n.ts sagt „Lernweg"', () => {
  const sources = [
    ...readdirSync(resolve(process.cwd(), 'dictionaries')).filter(name => name.endsWith('.json')).map(name => `dictionaries/${name}`),
    ...readdirSync(resolve(process.cwd(), 'lib')).filter(name => name.endsWith('-i18n.ts')).map(name => `lib/${name}`),
  ]
  expect(sources.length).toBeGreaterThan(10)
  const hits = sources.flatMap(path => readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')
    .map((line, index) => /lernweg/i.test(line) ? `${path}:${index + 1}` : null).filter(Boolean))
  expect(hits).toEqual([])
})

it.each(Object.keys(PATH_TERMS))('„Lernpfad" auf %s steht nur dort, wo der deutsche Text den Grammatik-Lernpfad meint', lang => {
  const term = PATH_TERMS[lang]
  const misuse: string[] = []
  const german = STUDENT_MESSAGES.de as Record<string, string>
  for (const [key, text] of Object.entries(STUDENT_MESSAGES[lang as keyof typeof STUDENT_MESSAGES])) {
    if (term.test(text) && !/Lernpfad/.test(german[key] ?? '')) misuse.push(`student-ui-i18n ${lang}.${key}: ${text}`)
  }
  for (const [key, text] of Object.entries(dictionaries[lang])) {
    if (term.test(text) && !/Lernpfad/.test(dictionaries.de[key] ?? '')) misuse.push(`dictionaries/${lang}.json ${key}: ${text}`)
  }
  expect(misuse).toEqual([])
})

it('die Vokabel-Lektionen heißen in allen Sprachen „Lektionen"', () => {
  expect(Object.fromEntries(Object.entries(STUDENT_MESSAGES).map(([lang, messages]) => [lang, messages.vocab_tab_lessons])))
    .toEqual({ de: 'Lektionen', en: 'Lessons', ru: 'Уроки', uk: 'Уроки', tr: 'Dersler' })
  for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) expect(dictionaries[lang]['dashboard.nav_lessons']).toBe(STUDENT_MESSAGES[lang as 'de'].vocab_tab_lessons)
})
