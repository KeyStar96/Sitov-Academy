import { getSitovVerbTenses } from './progression'
import type { SitovVerbTrainerState } from './contracts'
import type { SitovVerbProgress, SitovVerbTense } from './types'

export const SITOV_VERB_BOX_KEYS = [1, 2, 3, 4, 5, 6, 'learned'] as const
export type SitovVerbBoxKey = (typeof SITOV_VERB_BOX_KEYS)[number]
/** Mirrors sitov_submit_verb_answer; the verb trainer keeps its own schedule. */
export const SITOV_VERB_REVIEW_DAYS = [1, 1, 3, 7, 14, 30, 60] as const

export function sitovVerbBoxNumber(progress: SitovVerbProgress | null | undefined): number {
  if (!progress?.attempts || !Number.isFinite(progress.box)) return 1
  return Math.max(1, Math.min(7, Math.round(progress.box)))
}
export function sitovVerbBoxKey(box: number): SitovVerbBoxKey {
  return box >= 7 ? 'learned' : Math.max(1, Math.min(6, Math.round(box))) as SitovVerbBoxKey
}
export function sitovVerbBoxValue(key: SitovVerbBoxKey): number { return key === 'learned' ? 7 : key }

export interface SitovVerbBoxForm {
  tense: SitovVerbTense
  box: number
  key: SitovVerbBoxKey
  due: boolean
  progress: SitovVerbProgress | null
}
export interface SitovVerbBoxCard {
  verb: SitovVerbTrainerState['verbs'][number]
  box: number
  key: SitovVerbBoxKey
  due: boolean
  partlyAhead: boolean
  forms: SitovVerbBoxForm[]
}

/**
 * One verb, one compartment: the least advanced unlocked tense determines its
 * position, just as the weakest review direction does in the vocabulary box.
 * Newly unlocked tenses start in phase one without altering stored progress.
 * Only the verb trainer's selected, visible verbs and progress enter this view.
 */
export function buildSitovVerbLearningBox(state: SitovVerbTrainerState, now = Date.now()) {
  const selected = new Set(state.selectedIds)
  const progressByKey = new Map(state.progress.map(row => [`${row.verbId}:${row.tense}`, row]))
  const cards: SitovVerbBoxCard[] = state.verbs.filter(verb => selected.has(verb.id)).map(verb => {
    const forms = getSitovVerbTenses(state.level, verb).map(tense => {
      const progress = progressByKey.get(`${verb.id}:${tense}`) ?? null
      const box = sitovVerbBoxNumber(progress)
      const dueAt = progress?.nextReviewAt ? Date.parse(progress.nextReviewAt) : Number.NaN
      return { tense, box, key: sitovVerbBoxKey(box), progress,
        due: !progress?.attempts || !Number.isFinite(dueAt) || dueAt <= now }
    })
    const box = Math.min(...forms.map(form => form.box))
    return { verb, forms, box, key: sitovVerbBoxKey(box), due: forms.some(form => form.due),
      partlyAhead: forms.some(form => form.box > box) }
  })
  const forms = cards.flatMap(card => card.forms)
  const futureDates = forms.flatMap(form => {
    const time = form.progress?.nextReviewAt ? Date.parse(form.progress.nextReviewAt) : Number.NaN
    return Number.isFinite(time) && time > now ? [time] : []
  })
  return {
    cards,
    buckets: SITOV_VERB_BOX_KEYS.map(key => {
      const members = cards.filter(card => card.key === key)
      return { key, count: members.length, due: members.filter(card => card.due).length,
        halfKnown: members.filter(card => card.partlyAhead).length }
    }),
    totalVerbs: cards.length,
    totalForms: forms.length,
    practicedForms: forms.filter(form => !!form.progress?.attempts).length,
    freshForms: forms.filter(form => !form.progress?.attempts).length,
    confidentForms: forms.filter(form => form.box >= 6).length,
    learnedForms: forms.filter(form => form.box === 7).length,
    learnedVerbs: cards.filter(card => card.box === 7).length,
    dueForms: forms.filter(form => form.due).length,
    progressPercent: forms.length ? Math.round(forms.reduce((sum, form) => sum + (form.box - 1) / 6, 0) / forms.length * 100) : 0,
    nextReviewAt: futureDates.length ? new Date(Math.min(...futureDates)).toISOString() : null,
  }
}
