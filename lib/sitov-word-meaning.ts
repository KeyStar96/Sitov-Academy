import { SITOV_VERB_CATALOG } from '@/lib/verbs/catalog'
import type { SitovVerbLocale } from '@/lib/verbs/types'

export interface SitovWordMeaning { word: string; base: string; translation: string; locale: SitovVerbLocale }
export type SitovWordMeaningResult = { ok: true; meaning: SitovWordMeaning | null } | { ok: false }

/** Punctuation belongs to the reading, never to a dictionary lookup or filter. */
export function sitovLookupWord(word: string): string {
  return word.normalize('NFC').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLocaleLowerCase('de')
}

type Meanings = [string, string, string, string]
// Function words are usually absent from the vocabulary box. These reviewed
// meanings complement authored vocabulary; German UI explains their function.
const sitovFunctionWords: Record<string, { de: string; values: Meanings }> = {
  ich: { de: 'die sprechende Person', values: ['I', 'я', 'я', 'ben'] },
  du: { de: 'die angesprochene Person', values: ['you', 'ты', 'ти', 'sen'] },
  er: { de: 'männliche Person', values: ['he', 'он', 'він', 'o (erkek)'] },
  sie: { de: 'sie / sie (Mehrzahl)', values: ['she / they', 'она / они', 'вона / вони', 'o / onlar'] },
  es: { de: 'Pronomen für ein sächliches Nomen', values: ['it', 'оно / это', 'воно / це', 'o / bu'] },
  wir: { de: 'die sprechende Person und andere', values: ['we', 'мы', 'ми', 'biz'] },
  ihr: { de: 'mehrere angesprochene Personen / ihr Besitz', values: ['you (plural) / her', 'вы / её', 'ви / її', 'siz / onun'] },
  mir: { de: 'Dativ von „ich“', values: ['to me', 'мне', 'мені', 'bana'] },
  mich: { de: 'Akkusativ von „ich“', values: ['me', 'меня', 'мене', 'beni'] },
  dir: { de: 'Dativ von „du“', values: ['to you', 'тебе', 'тобі', 'sana'] },
  dich: { de: 'Akkusativ von „du“', values: ['you', 'тебя', 'тебе', 'seni'] },
  uns: { de: 'Dativ / Akkusativ von „wir“', values: ['us', 'нас / нам', 'нас / нам', 'bizi / bize'] },
  sich: { de: 'rückbezügliches Pronomen', values: ['oneself / themselves', 'себя', 'себе', 'kendisi'] },
  man: { de: 'Menschen allgemein', values: ['one / people', 'люди / кто-то', 'люди / хтось', 'insan / biri'] },
  der: { de: 'bestimmter Artikel', values: ['the', 'определённый артикль', 'означений артикль', 'belirli tanımlık'] },
  ein: { de: 'unbestimmter Artikel / Zahl 1', values: ['a / one', 'один / неопределённый артикль', 'один / неозначений артикль', 'bir'] },
  kein: { de: 'verneinter unbestimmter Artikel', values: ['no / not a', 'никакой / ни один', 'жодний / ні один', 'hiç / bir değil'] },
  mein: { de: 'Besitz der sprechenden Person', values: ['my', 'мой', 'мій', 'benim'] },
  dein: { de: 'Besitz der angesprochenen Person', values: ['your', 'твой', 'твій', 'senin'] },
  sein: { de: 'Grundform von „ist“ / Besitz einer männlichen Person', values: ['to be / his', 'быть / его', 'бути / його', 'olmak / onun'] },
  unser: { de: 'Besitz von „wir“', values: ['our', 'наш', 'наш', 'bizim'] },
  euer: { de: 'Besitz von „ihr“', values: ['your (plural)', 'ваш', 'ваш', 'sizin'] },
  und: { de: 'verbindet Wörter oder Sätze', values: ['and', 'и', 'і / та', 've'] },
  oder: { de: 'stellt eine Wahl vor', values: ['or', 'или', 'або', 'veya'] },
  aber: { de: 'zeigt einen Gegensatz', values: ['but', 'но', 'але', 'ama'] },
  denn: { de: 'leitet eine Begründung ein', values: ['because / for', 'потому что', 'тому що', 'çünkü'] },
  weil: { de: 'leitet einen Grund ein', values: ['because', 'потому что', 'тому що', 'çünkü'] },
  dass: { de: 'leitet einen Nebensatz ein', values: ['that', 'что', 'що', '… olduğunu'] },
  wenn: { de: 'Bedingung oder wiederholte Zeit', values: ['if / when', 'если / когда', 'якщо / коли', 'eğer / … zaman'] },
  als: { de: 'Vergleich / Zeitpunkt in der Vergangenheit', values: ['than / as / when', 'чем / как / когда', 'ніж / як / коли', '…den / olarak / … zaman'] },
  auch: { de: 'zusätzlich', values: ['also / too', 'тоже / также', 'теж / також', 'de / da / ayrıca'] },
  nicht: { de: 'verneint eine Aussage', values: ['not', 'не', 'не', 'değil'] },
  nur: { de: 'ausschließlich', values: ['only', 'только', 'лише / тільки', 'sadece'] },
  noch: { de: 'weiterhin / zusätzlich', values: ['still / yet', 'ещё', 'ще', 'hâlâ / henüz'] },
  schon: { de: 'bereits', values: ['already', 'уже', 'вже', 'zaten / çoktan'] },
  sehr: { de: 'in hohem Maß', values: ['very', 'очень', 'дуже', 'çok'] },
  so: { de: 'auf diese Weise', values: ['so / like this', 'так', 'так', 'böyle'] },
  ja: { de: 'Zustimmung', values: ['yes', 'да', 'так', 'evet'] },
  nein: { de: 'Ablehnung', values: ['no', 'нет', 'ні', 'hayır'] },
  in: { de: 'innerhalb von etwas', values: ['in / into', 'в', 'в / у', 'içinde / içine'] },
  im: { de: 'in dem', values: ['in the', 'в', 'в / у', '…de / içinde'] },
  ins: { de: 'in das', values: ['into the', 'в', 'в / у', '…e / içine'] },
  am: { de: 'an dem', values: ['at / on the', 'на / у / в', 'на / біля / у', '…de / yanında'] },
  an: { de: 'direkt neben / an einer Fläche', values: ['at / on', 'на / у', 'на / біля', '…de / yanında'] },
  auf: { de: 'oben auf einer Fläche', values: ['on / onto', 'на', 'на', 'üzerinde / üzerine'] },
  aus: { de: 'Herkunft / von innen nach außen', values: ['from / out of', 'из', 'з / із', '…den / içinden'] },
  bei: { de: 'in der Nähe von / bei einer Person', values: ['at / near / with', 'у / при', 'у / біля', 'yanında / …de'] },
  mit: { de: 'gemeinsam / mithilfe von', values: ['with', 'с', 'з / із', 'ile'] },
  nach: { de: 'Richtung / später als', values: ['to / after', 'в / после', 'до / після', '…e / sonra'] },
  von: { de: 'Herkunft / Zugehörigkeit', values: ['from / of', 'от / из', 'від / з', '…den / …nin'] },
  vom: { de: 'von dem', values: ['from the', 'от / из', 'від / з', '…den'] },
  zu: { de: 'Richtung zu einer Person oder Sache', values: ['to / too', 'к / слишком', 'до / занадто', '…e / fazla'] },
  zum: { de: 'zu dem', values: ['to the', 'к', 'до', '…e'] },
  zur: { de: 'zu der', values: ['to the', 'к', 'до', '…e'] },
  für: { de: 'Zweck / Empfänger', values: ['for', 'для / за', 'для / за', 'için'] },
  ohne: { de: 'nicht zusammen mit', values: ['without', 'без', 'без', 'olmadan'] },
  über: { de: 'oberhalb / zum Thema', values: ['above / about', 'над / о', 'над / про', 'üstünde / hakkında'] },
  unter: { de: 'unterhalb / zwischen mehreren', values: ['under / among', 'под / среди', 'під / серед', 'altında / arasında'] },
  vor: { de: 'früher als / davor', values: ['before / in front of', 'перед / до', 'перед / до', 'önce / önünde'] },
  um: { de: 'Uhrzeit / rundherum', values: ['at / around', 'в / вокруг', 'о / навколо', 'saat …de / etrafında'] },
  bis: { de: 'Endpunkt in Zeit oder Raum', values: ['until / to', 'до', 'до', '…e kadar'] },
  seit: { de: 'Beginn eines noch andauernden Zeitraums', values: ['since / for', 'с / уже', 'з / уже', '…den beri'] },
  zwischen: { de: 'in der Mitte von zwei oder mehreren', values: ['between', 'между', 'між', 'arasında'] },
  hier: { de: 'an diesem Ort', values: ['here', 'здесь', 'тут', 'burada'] },
  dort: { de: 'an jenem Ort', values: ['there', 'там', 'там', 'orada'] },
  heute: { de: 'an diesem Tag', values: ['today', 'сегодня', 'сьогодні', 'bugün'] },
  morgen: { de: 'am nächsten Tag', values: ['tomorrow', 'завтра', 'завтра', 'yarın'] },
  gestern: { de: 'am Tag davor', values: ['yesterday', 'вчера', 'вчора', 'dün'] },
  jetzt: { de: 'in diesem Moment', values: ['now', 'сейчас', 'зараз', 'şimdi'] },
  dann: { de: 'danach / in diesem Fall', values: ['then', 'потом / тогда', 'потім / тоді', 'sonra / o zaman'] },
  immer: { de: 'jedes Mal / jederzeit', values: ['always', 'всегда', 'завжди', 'her zaman'] },
  wieder: { de: 'noch einmal', values: ['again', 'снова', 'знову', 'yeniden'] },
  zusammen: { de: 'gemeinsam', values: ['together', 'вместе', 'разом', 'birlikte'] },
  wie: { de: 'fragt nach Art und Weise / vergleicht', values: ['how / like', 'как', 'як', 'nasıl / gibi'] },
  was: { de: 'fragt nach einer Sache', values: ['what', 'что', 'що', 'ne'] },
  wer: { de: 'fragt nach einer Person', values: ['who', 'кто', 'хто', 'kim'] },
  wo: { de: 'fragt nach einem Ort', values: ['where', 'где', 'де', 'nerede'] },
  wann: { de: 'fragt nach der Zeit', values: ['when', 'когда', 'коли', 'ne zaman'] },
  warum: { de: 'fragt nach einem Grund', values: ['why', 'почему', 'чому', 'neden'] },
  viele: { de: 'eine große Anzahl', values: ['many', 'много', 'багато', 'çok / birçok'] },
  alle: { de: 'die gesamte Menge', values: ['all / everyone', 'все', 'усі', 'hepsi / herkes'] },
  etwas: { de: 'eine unbestimmte Sache oder Menge', values: ['something / a little', 'что-то / немного', 'щось / трохи', 'bir şey / biraz'] },
}

const sitovAliases: Record<string, string> = {}
for (const word of ['die', 'das', 'den', 'dem', 'des']) sitovAliases[word] = 'der'
for (const base of ['ein', 'kein', 'mein', 'dein', 'sein', 'unser', 'euer']) {
  for (const ending of ['e', 'en', 'em', 'er', 'es']) sitovAliases[`${base === 'euer' ? 'eur' : base}${ending}`] = base
}

/** Actual conjugated forms resolve to a reviewed infinitive, never guessed stems. */
const sitovVerbForms = new Map<string, (typeof SITOV_VERB_CATALOG)[number]>()
for (const verb of SITOV_VERB_CATALOG) {
  const forms = [verb.infinitive, ...verb.present, ...verb.past, ...verb.participles,
    ...Object.values(verb.presentAlternatives ?? {}).flat(), ...Object.values(verb.pastAlternatives ?? {}).flat()]
  for (const form of forms) {
    const normalized = sitovLookupWord(form)
    if (!normalized.includes(' ') && !sitovVerbForms.has(normalized)) sitovVerbForms.set(normalized, verb)
  }
}

export function sitovLocalWordMeaning(word: string, locale: SitovVerbLocale): SitovWordMeaning | null {
  const normalized = sitovLookupWord(word)
  const base = sitovAliases[normalized] ?? normalized
  const entry = sitovFunctionWords[base]
  if (entry) return { word, base, locale, translation: locale === 'de' ? entry.de : entry.values[(['en', 'ru', 'uk', 'tr'] as const).indexOf(locale)] }
  const verb = sitovVerbForms.get(normalized)
  return verb ? { word, base: verb.infinitive, locale, translation: verb.translations[locale] } : null
}

/** A bounded set for authored noun/adjective declensions; no arbitrary fuzzy match. */
export function sitovWordCandidates(word: string): string[] {
  const normalized = sitovLookupWord(word)
  return [...new Set([normalized, normalized.replace(/(?:em|en|er|es|e)$/u, ''), normalized.replace(/(?:es|s|n)$/u, '')])].filter(value => value.length > 1)
}
