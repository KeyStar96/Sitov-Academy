'use server'

import * as sitovVerbs from '@/lib/verbs/server'
export async function loadSitovVerbTrainer(level: Parameters<typeof sitovVerbs.loadSitovVerbTrainer>[0], lang?: string) { return sitovVerbs.loadSitovVerbTrainer(level, lang) }
export async function setSitovVerbBox(input: Parameters<typeof sitovVerbs.setSitovVerbBox>[0]) { return sitovVerbs.setSitovVerbBox(input) }
export async function nextSitovVerbExercise(input: Parameters<typeof sitovVerbs.nextSitovVerbExercise>[0], lang?: string) { return sitovVerbs.nextSitovVerbExercise(input, lang) }
export async function submitSitovVerbAnswer(input: Parameters<typeof sitovVerbs.submitSitovVerbAnswer>[0]) { return sitovVerbs.submitSitovVerbAnswer(input) }
export async function checkSitovVerbRetry(input: Parameters<typeof sitovVerbs.checkSitovVerbRetry>[0]) { return sitovVerbs.checkSitovVerbRetry(input) }
