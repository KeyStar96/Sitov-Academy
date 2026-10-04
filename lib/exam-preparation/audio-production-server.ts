import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import { requireSitovStaffMfa } from '@/lib/sitov-staff-mfa'
import { createAdminClient } from '@/utils/supabase/admin'
import { validWordTimings } from '@/lib/audio/playback-settings'
import type { AudioWordTiming } from '@/lib/types/audio'
import type { Json } from '@/supabase/database.types'
import type { ExamProductionRow } from '@/supabase/exam-preparation.types'
import { EXAM_AUDIO_ORDERS } from './content'

export const EXAM_PRODUCTION_BUCKET = 'sitov-exam-productions'
export type ExamProductionStatus = ExamProductionRow['status']
export type ExamAudioProduction = {
  audioId: string; status: ExamProductionStatus; rawUrl: string | null; preparedUrl: string | null
  rawFilename: string | null; preparedFilename: string | null; reviewNote: string | null
  reviewedAt: string | null; publishedAt: string | null; updatedAt: string; scriptMatches: boolean
  wordTimings: AudioWordTiming[] | null
}
export type ExamAudioProductionState = { success: boolean; error?: string; productions: ExamAudioProduction[] }
export type ExamProductionResult = { success: boolean; error?: string }
export type ExamProductionUploadTicket = ExamProductionResult & { path?: string; token?: string; bucket?: string }
const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' }

async function staffContext() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) throw new Error('Bitte melde dich erneut an.')
  const { data: profile, error } = await session.from('profiles').select('role,sitov_mfa_required').eq('id', user.id).single()
  if (error || (profile?.role !== 'admin' && profile?.role !== 'teacher')) throw new Error('Nur Lehrkräfte können Aufnahmeaufträge verwalten.')
  await requireSitovStaffMfa(session, profile)
  return { user, admin: createAdminClient() }
}

function orderFor(audioId: string) {
  const order = EXAM_AUDIO_ORDERS.find(candidate => candidate.audioId === audioId)
  if (!order || order.route !== 'human') throw new Error('Dieser menschliche Aufnahmeauftrag ist nicht vorhanden.')
  return order
}
function scriptHash(audioId: string) { return createHash('sha256').update(spokenText(audioId)).digest('hex') }
function spokenText(audioId: string) {
  const order = orderFor(audioId)
  return ('spokenText' in order && typeof order.spokenText === 'string') ? order.spokenText : order.script
}
function measuredTimings(audioId: string, value: unknown) {
  const timings = validWordTimings(value, spokenText(audioId))
  return timings?.some(word => word.end > word.start) ? timings : undefined
}
function safeFailure(error: unknown, fallback: string): ExamProductionResult {
  return { success: false, error: error instanceof Error ? error.message : fallback }
}
async function signedUrl(admin: ReturnType<typeof createAdminClient>, path: string | null) {
  if (!path) return null
  const { data, error } = await admin.storage.from(EXAM_PRODUCTION_BUCKET).createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}
async function existingRow(admin: ReturnType<typeof createAdminClient>, audioId: string) {
  const { data, error } = await admin.from('sitov_exam_audio_productions').select('*').eq('audio_id', audioId).maybeSingle()
  if (error) throw new Error('Der Produktionsstand konnte nicht geladen werden. Die Datenbankfreigabe muss vorhanden sein.')
  return data
}
async function uploadedFile(admin: ReturnType<typeof createAdminClient>, path: string) {
  const split = path.lastIndexOf('/')
  const { data, error } = await admin.storage.from(EXAM_PRODUCTION_BUCKET).list(path.slice(0, split), { search: path.slice(split + 1), limit: 100 })
  const file = data?.find(candidate => candidate.name === path.slice(split + 1))
  const size = Number(file?.metadata?.size)
  const mime = String(file?.metadata?.mimetype || '').split(';')[0]
  if (error || !file || !Number.isFinite(size) || size <= 0 || size > MAX_AUDIO_BYTES || !MIME_EXTENSIONS[mime]) throw new Error('Die Audiodatei ist noch nicht vollständig hochgeladen oder entspricht nicht dem erlaubten Format (maximal 20 MB).')
}

export async function loadExamAudioProductionState(): Promise<ExamAudioProductionState> {
  try {
    const { admin } = await staffContext()
    const { data, error } = await admin.from('sitov_exam_audio_productions').select('*').order('audio_id')
    if (error) return { success: false, error: 'Der Aufnahmeplan kann erst nach der Datenbankfreigabe geladen werden.', productions: [] }
    const productions = await Promise.all((data ?? []).filter(row => EXAM_AUDIO_ORDERS.some(order => order.audioId === row.audio_id)).map(async row => {
      const [rawUrl, preparedUrl] = await Promise.all([signedUrl(admin, row.raw_path), signedUrl(admin, row.prepared_path)])
      return { audioId: row.audio_id, status: row.status, rawUrl, preparedUrl, rawFilename: row.raw_filename, preparedFilename: row.prepared_filename, reviewNote: row.review_note, reviewedAt: row.reviewed_at, publishedAt: row.published_at, updatedAt: row.updated_at, scriptMatches: row.script_hash === scriptHash(row.audio_id), wordTimings: validWordTimings(row.word_timings) ?? null }
    }))
    return { success: true, productions }
  } catch (error) { return { ...safeFailure(error, 'Der Aufnahmeplan konnte nicht geladen werden.'), productions: [] } }
}

export async function prepareExamProductionUpload(input: { audioId: string; kind: 'raw' | 'prepared'; contentType: string; size: number }): Promise<ExamProductionUploadTicket> {
  try {
    const { user, admin } = await staffContext()
    orderFor(input.audioId)
    const contentType = input.contentType.split(';')[0].trim()
    if (!MIME_EXTENSIONS[contentType] || !Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_AUDIO_BYTES || !['raw', 'prepared'].includes(input.kind)) throw new Error('Bitte wähle eine Audiodatei bis 20 MB (M4A, MP3, WAV, OGG oder WebM).')
    const path = `${user.id}/${input.audioId}/${input.kind}/${randomUUID()}.${MIME_EXTENSIONS[contentType]}`
    const { data, error } = await admin.storage.from(EXAM_PRODUCTION_BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (error) throw new Error('Der private Upload konnte nicht vorbereitet werden. Bitte versuche es erneut.')
    return { success: true, path: data.path, token: data.token, bucket: EXAM_PRODUCTION_BUCKET }
  } catch (error) { return safeFailure(error, 'Der Upload konnte nicht vorbereitet werden.') }
}

export async function finishExamProductionUpload(input: { audioId: string; kind: 'raw' | 'prepared'; path: string; filename: string; wordTimings?: unknown }): Promise<ExamProductionResult> {
  try {
    const { user, admin } = await staffContext()
    orderFor(input.audioId)
    if (!['raw', 'prepared'].includes(input.kind)) throw new Error('Ungültige Dateiversion.')
    const prefix = `${user.id}/${input.audioId}/${input.kind}/`
    if (!input.path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(mp3|m4a|wav|ogg|webm)$/.test(input.path.slice(prefix.length))) throw new Error('Der Upload gehört nicht zu diesem Aufnahmeauftrag.')
    const wordTimings = input.kind === 'prepared' ? measuredTimings(input.audioId, input.wordTimings) : undefined
    if (input.kind === 'prepared' && !wordTimings) throw new Error('Für die Schnittfassung fehlen passende Wortzeitmarken aus der tatsächlichen Aufnahme. Erwartet wird ein Eintrag {start,end} pro gesprochenem Wort.')
    await uploadedFile(admin, input.path)
    const previous = await existingRow(admin, input.audioId)
    if (input.kind === 'prepared' && (!previous?.raw_path || previous.script_hash !== scriptHash(input.audioId))) throw new Error('Bitte lade zuerst die Rohaufnahme des aktuellen Skripts hoch.')
    if (input.kind === 'prepared') await uploadedFile(admin, previous!.raw_path!)
    const filename = input.filename.replace(/[\u0000-\u001f/\\]/g, '').trim().slice(0, 200)
    const update = {
      script_hash: scriptHash(input.audioId), status: 'uploaded' as const, reviewed_by: null, reviewed_at: null, published_at: null, review_note: null, updated_at: new Date().toISOString(),
      ...(input.kind === 'raw' ? { raw_path: input.path, raw_filename: filename, prepared_path: null, prepared_filename: null, word_timings: null } : { prepared_path: input.path, prepared_filename: filename, word_timings: wordTimings as unknown as Json }),
    }
    const result = previous
      ? await admin.from('sitov_exam_audio_productions').update(update).eq('audio_id', input.audioId).eq('updated_at', previous.updated_at).select('audio_id')
      : await admin.from('sitov_exam_audio_productions').insert({ ...update, audio_id: input.audioId, created_by: user.id }).select('audio_id')
    if (result.error || !result.data?.length) throw new Error('Der Produktionsstand hat sich geändert oder konnte nicht gespeichert werden. Lade die Ansicht neu; die hochgeladene Datei bleibt privat erhalten.')
    return { success: true }
  } catch (error) { return safeFailure(error, 'Der Upload konnte nicht abgeschlossen werden.') }
}

export async function changeExamProductionStatus(input: { audioId: string; status: ExamProductionStatus; reviewNote?: string; checks?: boolean[] }): Promise<ExamProductionResult> {
  try {
    const { user, admin } = await staffContext()
    orderFor(input.audioId)
    const previous = await existingRow(admin, input.audioId)
    const earlyStatuses = ['briefing', 'script_review', 'ready_to_record', 'awaiting_recording']
    const reviewed = input.status === 'reviewed'
    const published = input.status === 'published'
    if (!earlyStatuses.includes(input.status) && !reviewed && !published) throw new Error('Dieser Status entsteht durch den Dateiupload.')
    const now = new Date().toISOString()
    let update = { status: input.status, script_hash: scriptHash(input.audioId), updated_at: now, reviewed_by: null as string | null, reviewed_at: null as string | null, published_at: null as string | null, review_note: null as string | null }
    if (reviewed || published) {
      if (!previous?.raw_path || !previous.prepared_path || previous.script_hash !== scriptHash(input.audioId) || !measuredTimings(input.audioId, previous.word_timings)) throw new Error('Rohaufnahme, Schnittfassung und tatsächliche Wortzeitmarken des aktuellen Skripts müssen zuerst hochgeladen werden.')
      await Promise.all([uploadedFile(admin, previous.raw_path), uploadedFile(admin, previous.prepared_path)])
      if (reviewed) {
        if (!input.checks || input.checks.length !== 6 || input.checks.some(value => value !== true) || !input.reviewNote?.trim() || input.reviewNote.trim().length < 10 || input.reviewNote.length > 4000) throw new Error('Bitte bestätige alle sechs Prüfungen und dokumentiere die fachliche Freigabe.')
        update = { ...update, reviewed_by: user.id, reviewed_at: now, review_note: input.reviewNote.trim() }
      } else {
        if (previous.status !== 'reviewed' || !previous.reviewed_by || !previous.reviewed_at || !previous.review_note) throw new Error('Die Schnittfassung muss vor der Veröffentlichung fachlich geprüft sein.')
        update = { ...update, reviewed_by: previous.reviewed_by, reviewed_at: previous.reviewed_at, review_note: previous.review_note, published_at: now }
      }
    }
    const result = previous
      ? await admin.from('sitov_exam_audio_productions').update(update).eq('audio_id', input.audioId).eq('updated_at', previous.updated_at).select('audio_id')
      : await admin.from('sitov_exam_audio_productions').insert({ ...update, audio_id: input.audioId, created_by: user.id }).select('audio_id')
    if (result.error || !result.data?.length) throw new Error('Der Produktionsstand konnte nicht gespeichert werden. Lade die Ansicht neu und versuche es erneut.')
    return { success: true }
  } catch (error) { return safeFailure(error, 'Der Produktionsstand konnte nicht gespeichert werden.') }
}

/** Student-facing DAL returns only published, script-bound final assets, never raw recordings. */
export const getPublishedExamAudio = cache(async (): Promise<Record<string, { src: string; wordTimings: AudioWordTiming[] }>> => {
  try {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return {}
  const admin = createAdminClient()
  const { data, error } = await admin.from('sitov_exam_audio_productions').select('*').eq('status', 'published')
  if (error) return {}
  const assets = await Promise.all((data ?? []).map(async row => {
    if (!EXAM_AUDIO_ORDERS.some(order => order.audioId === row.audio_id) || row.script_hash !== scriptHash(row.audio_id) || !row.reviewed_by || !row.reviewed_at || !row.published_at) return null
    const wordTimings = measuredTimings(row.audio_id, row.word_timings)
    if (!wordTimings || !row.prepared_path) return null
    try { await uploadedFile(admin, row.prepared_path) } catch { return null }
    const src = await signedUrl(admin, row.prepared_path)
    const order = orderFor(row.audio_id)
    return src ? [row.audio_id, ...order.tasks.map(task => task.audio?.id).filter((id): id is string => Boolean(id))].map(id => [id, { src, wordTimings }] as const) : []
  }))
  return Object.fromEntries(assets.filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)).flat())
  } catch { return {} }
})
