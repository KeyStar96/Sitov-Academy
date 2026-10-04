import 'server-only'

import sitovA1 from '@/content/daily-quests/sitov-a1.json'
import sitovA2 from '@/content/daily-quests/sitov-a2.json'
import sitovB1 from '@/content/daily-quests/sitov-b1.json'
import sitovB2 from '@/content/daily-quests/sitov-b2.json'
import sitovRoles from '@/content/daily-quests/sitov-question-roles.json'
import sitovEn from '@/content/daily-quests/locales/sitov-en.json'
import sitovRu from '@/content/daily-quests/locales/sitov-ru.json'
import sitovUk from '@/content/daily-quests/locales/sitov-uk.json'
import sitovTr from '@/content/daily-quests/locales/sitov-tr.json'
import type { DailyQuest, DailyQuestStepResult } from '@/lib/daily-quest-contract'
import { toUiLocale, type UiLocale } from '@/lib/locale-routing'
import { getSitovDailyQuestFeedbackFallback, getSitovDailyQuestPresentationCopy, isSitovDailyQuestDirection } from '@/lib/sitov-daily-quest-presentation'

type SitovTranslation = { goal: string; explanation: string; focus: string; question: string }
type SitovSource = { goal: string; explanation: string; focus: string; question: string }
const sitovTranslations: Record<Exclude<UiLocale, 'de'>, Record<string, SitovTranslation>> = { en: sitovEn, ru: sitovRu, uk: sitovUk, tr: sitovTr }
const sitovSources = new Map<string, SitovSource>([
  ...sitovA1.map(row => [`sitov-a1-${row.slug}`, row] as const), ...sitovA2.map(row => [`sitov-a2-${row.slug}`, row] as const),
  ...sitovB1.map(row => [`sitov-b1-${row.slug}`, row] as const), ...sitovB2.map(row => [`sitov-b2-${row.slug}`, row] as const),
])
const sitovQuestionRoles: Record<string, string> = sitovRoles

const sitovLocations: Record<string, readonly [string, string, string, string]> = {
  'Supermarkt': ['Supermarket', 'Супермаркет', 'Супермаркет', 'Süpermarket'],
  'Café': ['Café', 'Кафе', 'Кафе', 'Kafe'], 'Bahnhof': ['Railway station', 'Вокзал', 'Вокзал', 'Tren istasyonu'],
  'Haltestelle': ['Bus stop', 'Остановка', 'Зупинка', 'Durak'], 'Restaurant': ['Restaurant', 'Ресторан', 'Ресторан', 'Restoran'],
  'Apotheke': ['Pharmacy', 'Аптека', 'Аптека', 'Eczane'], 'Arztpraxis': ['Medical practice', 'Врачебная практика', 'Лікарська практика', 'Doktor muayenehanesi'],
  'Postfiliale': ['Post office', 'Почтовое отделение', 'Поштове відділення', 'Postane'], 'Bankfiliale': ['Bank branch', 'Отделение банка', 'Відділення банку', 'Banka şubesi'],
  'Bibliothek': ['Library', 'Библиотека', 'Бібліотека', 'Kütüphane'], 'Büro': ['Office', 'Офис', 'Офіс', 'Ofis'],
  'Sitov Academy': ['Sitov Academy', 'Sitov Academy', 'Sitov Academy', 'Sitov Academy'],
  'Wohnhaus': ['Residential building', 'Жилой дом', 'Житловий будинок', 'Konut binası'], 'Werkstatt': ['Workshop', 'Мастерская', 'Майстерня', 'Tamir atölyesi'],
  'Stadtpark': ['City park', 'Городской парк', 'Міський парк', 'Şehir parkı'], 'Sportzentrum': ['Sports centre', 'Спортивный центр', 'Спортивний центр', 'Spor merkezi'],
  'Hotel': ['Hotel', 'Отель', 'Готель', 'Otel'], 'Bekleidungsgeschäft': ['Clothes shop', 'Магазин одежды', 'Магазин одягу', 'Giyim mağazası'],
  'Wochenmarkt': ['Market', 'Рынок', 'Ринок', 'Pazar'], 'Stadtzentrum': ['City centre', 'Центр города', 'Центр міста', 'Şehir merkezi'],
  'Bäckerei': ['Bakery', 'Пекарня', 'Пекарня', 'Fırın'], 'Besprechung in der Bäckerei': ['Meeting at the bakery', 'Встреча в пекарне', 'Зустріч у пекарні', 'Fırında toplantı'],
  'Gespräch in der Bäckerei': ['Conversation at the bakery', 'Разговор в пекарне', 'Розмова в пекарні', 'Fırında konuşma'],
  'Frühstücksplanung in der Bäckerei': ['Planning breakfast at the bakery', 'Планирование завтрака в пекарне', 'Планування сніданку в пекарні', 'Fırında kahvaltı planlama'],
}
const sitovLocaleIndex = { en: 0, ru: 1, uk: 2, tr: 3 } as const
const sitovStarterGoals: Record<string, readonly [string, string, string, string]> = {
  'sitov-bakery-breakfast': ['Order a small breakfast politely.', 'Вежливо закажи небольшой завтрак.', 'Ввічливо замов невеликий сніданок.', 'Küçük bir kahvaltıyı kibarca sipariş et.'],
  'sitov-picnic-plan': ['Explain what you need for a picnic.', 'Объясни, что тебе нужно для пикника.', 'Поясни, що тобі потрібно для пікніка.', 'Piknik için neye ihtiyacın olduğunu açıkla.'],
  'sitov-order-change': ['Politely ask to change your order.', 'Вежливо попроси изменить заказ.', 'Ввічливо попроси змінити замовлення.', 'Siparişini değiştirmeyi kibarca iste.'],
  'sitov-catering-alternative': ['Give a reason for your suggestion for the group.', 'Обоснуй своё предложение для группы.', 'Обґрунтуй свою пропозицію для групи.', 'Grup için önerini gerekçelendir.'],
  'sitov-local-sourcing': ['Carefully weigh up cost and origin.', 'Взвесь стоимость и происхождение, учитывая разные стороны.', 'Зваж вартість і походження, враховуючи різні аспекти.', 'Maliyet ve menşei farklı yönleriyle değerlendir.'],
  'sitov-menu-deliberation': ['Express a limitation diplomatically.', 'Дипломатично сформулируй ограничение.', 'Дипломатично сформулюй обмеження.', 'Bir sınırlamayı diplomatik biçimde ifade et.'],
}

/** Display-only overlay: frozen database snapshots, answer IDs and German audio are never rewritten. */
export function localizeSitovDailyQuest(quest: DailyQuest, locale: string): DailyQuest {
  const sitovLocale = toUiLocale(locale)
  if (sitovLocale === 'de') return quest
  const copy = getSitovDailyQuestPresentationCopy(sitovLocale)
  const source = sitovSources.get(quest.templateKey)
  const translation = sitovTranslations[sitovLocale][quest.templateKey]
  const index = sitovLocaleIndex[sitovLocale]
  const location = sitovLocations[quest.scene.location]?.[index] ?? ''
  const goal = source && translation && quest.subtitle === source.goal ? translation.goal : sitovStarterGoals[quest.templateKey]?.[index] ?? copy.goal
  const imageAlt = location ? [
    `An everyday scene at: ${location}. The scene includes a male learning character.`,
    `Повседневная сцена: ${location}. В сцене изображён мужской учебный персонаж.`,
    `Повсякденна сцена: ${location}. У сцені зображено чоловічого навчального персонажа.`,
    `Günlük yaşam sahnesi: ${location}. Sahnede erkek bir öğrenme karakteri yer alıyor.`,
  ][index] : ['An everyday scene with a male learning character.', 'Повседневная сцена с мужским учебным персонажем.', 'Повсякденна сцена з чоловічим навчальним персонажем.', 'Erkek bir öğrenme karakterinin yer aldığı günlük yaşam sahnesi.'][index]
  return { ...quest, sitovUiLocale: sitovLocale, subtitle: goal,
    scene: { ...quest.scene, location: location || quest.scene.location, imageAlt,
      characters: quest.scene.characters.map(character => character.name === 'Du' ? { ...character, name: copy.you } : character) },
    steps: quest.steps.map(step => {
      if (step.kind === 'discover') return { ...step, instruction: copy.discover }
      if (step.kind === 'sentence_build') return { ...step, prompt: `${source && translation && step.prompt === `${source.goal} Setze den Satz zusammen.` ? translation.goal : goal} ${copy.build}` }
      const instructional = Boolean(source && translation && step.prompt === source.question && sitovQuestionRoles[quest.templateKey] === 'instruction')
      const sitovFallbackInstruction = (!source || step.prompt !== source.question) && isSitovDailyQuestDirection(step.prompt)
      return { ...step, sitovInstruction: copy.dialogue,
        prompt: instructional ? translation.question : sitovFallbackInstruction ? copy.dialogue : step.prompt, sitovPromptLocale: instructional || sitovFallbackInstruction ? sitovLocale : 'de' as const }
    }),
    completion: { title: copy.completionTitle, text: copy.completionText },
  }
}

/** Called only after the authenticated RPC grades the station. No grading map reaches students. */
export function localizeSitovDailyQuestFeedback(quest: DailyQuest, stepId: string, correct: boolean, feedback: string, locale: string): string {
  const sitovLocale = toUiLocale(locale)
  if (sitovLocale === 'de') return feedback
  const step = quest.steps.find(item => item.id === stepId)
  if (!step) return ''
  const source = sitovSources.get(quest.templateKey)
  const translation = sitovTranslations[sitovLocale][quest.templateKey]
  const fallback = getSitovDailyQuestFeedbackFallback(step.kind, correct, sitovLocale)
  if (!source || !translation) return fallback
  // Source guards prevent a later translation from changing the meaning of an old frozen version.
  if (correct && step.kind !== 'discover') {
    const prefix = step.kind === 'sentence_build' ? 'Der Satz passt. ' : 'Deine Antwort passt zur Situation. '
    if (feedback === `${prefix}${source.explanation}`) return `${fallback} ${translation.explanation}`
  }
  if (!correct && step.kind === 'sentence_build' && feedback === `Prüfe die Reihenfolge. Achte auf: ${source.focus}.`) {
    return `${fallback} ${getSitovDailyQuestPresentationCopy(sitovLocale).focus} ${translation.focus}.`
  }
  return fallback
}

export function localizeSitovDailyQuestStepResult(result: DailyQuestStepResult, stepId: string, locale: string): DailyQuestStepResult {
  return { ...result, feedback: localizeSitovDailyQuestFeedback(result.quest, stepId, result.correct, result.feedback, locale),
    quest: localizeSitovDailyQuest(result.quest, locale) }
}
