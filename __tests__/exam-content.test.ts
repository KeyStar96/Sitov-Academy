/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })

import {
  EXAM_AUDIO_ORDERS,
  EXAM_CONTENT_RELEASE,
  EXAM_MODULES,
  EXAM_PRACTICE_MODULES,
  EXAM_RECORDING_SESSIONS,
  EXAM_TASKS,
  EXAM_WORKSHOPS,
  getExamTask,
  getExamUnit,
} from '@/lib/exam-preparation/content'
import manifest from '@/scripts/sitov-exam-audio-manifest.json'
import type { ExamTask } from '@/lib/exam-preparation/types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { EXAM_PROFILES, examProfile } from '@/lib/exam-preparation/profiles'

const studentUnits = [...EXAM_MODULES, ...EXAM_WORKSHOPS].flatMap(module => module.units)
const allGroups = studentUnits.flatMap(unit => [unit.tasks, ...(unit.variants ?? [])])
const studentTasks = allGroups.flat()
const closed = (task: ExamTask) => task.type !== 'writing' && task.type !== 'speaking'

describe('fixed B1 pilot content', () => {
  it('keeps distinct official profiles and the verified structural corrections simulation-gated', () => {
    expect(EXAM_PROFILES).toHaveLength(7)
    expect(EXAM_PROFILES.every(profile => profile.simulationReleased === false)).toBe(true)
    for (const profile of EXAM_PROFILES) {
      expect(new Set(profile.parts.map(part => part.id)).size).toBe(profile.parts.length)
      expect(profile.checkedAt).toBe('2026-10-03')
      if (profile.id !== 'general_b1') expect(profile.source).toMatch(/^https:\/\//)
    }
    const dtz = examProfile('dtz_a2_b1')
    expect(dtz.parts.filter(part => part.skill === 'listening').reduce((sum, part) => sum + (part.decisions ?? 0), 0)).toBe(20)
    expect(dtz.parts.filter(part => part.skill === 'reading').reduce((sum, part) => sum + (part.decisions ?? 0), 0)).toBe(25)
    const scaled = examProfile('telc_deutsch_a2_b1')
    expect(scaled.parts.find(part => part.id === 'integrated-reading-2')?.decisions).toBe(2)
    expect(scaled.parts.filter(part => part.skill === 'speaking').map(part => part.title)).toEqual([
      'Sprechen 1A: Sich vorstellen', 'Sprechen 1B: Anschlussfragen beantworten',
      'Sprechen 2: Gemeinsam planen', 'Sprechen 3: Meinung begründen und diskutieren',
    ])
    expect(examProfile('oesd_zdoe_b1').preparation).toContain('10 Minuten')
    expect(examProfile('oesd_zb1').preparation).toContain('15 Minuten')
    expect(examProfile('telc_deutsch_b1').preparation).toContain('20 Minuten')
  })

  it('separates a complete pilot from the remaining planned course', () => {
    expect(EXAM_CONTENT_RELEASE).toBe('pilot')
    expect(EXAM_MODULES).toHaveLength(8)
    expect(EXAM_MODULES[0].releaseStatus).toBe('published')
    expect(EXAM_MODULES[0].units).toHaveLength(10)
    expect(EXAM_MODULES[0].units.reduce((count, unit) => count + unit.tasks.length, 0)).toBe(66)
    for (const plannedModule of EXAM_MODULES.slice(1)) {
      expect(plannedModule.releaseStatus).toBe('draft')
      expect(plannedModule.units).toHaveLength(10)
      expect(plannedModule.units.every(unit => unit.releaseStatus === 'draft')).toBe(true)
      expect(plannedModule.units.every(unit => unit.tasks.every(task => task.releaseStatus === 'draft'))).toBe(true)
    }
    expect(EXAM_WORKSHOPS).toHaveLength(5)
    expect(EXAM_WORKSHOPS.every(workshop => workshop.units.length === 6)).toBe(true)
    expect(studentUnits).toHaveLength(110)
  })

  it('uses unique, versioned IDs with a resolvable unit and task index', () => {
    expect(new Set(studentUnits.map(unit => unit.id)).size).toBe(studentUnits.length)
    expect(new Set(studentTasks.map(task => task.id)).size).toBe(studentTasks.length)
    expect(new Set(EXAM_TASKS.map(task => task.id)).size).toBe(EXAM_TASKS.length)
    for (const unit of studentUnits) expect(getExamUnit(unit.id)).toBe(unit)
    for (const task of EXAM_TASKS) {
      expect(task.id).toMatch(/^sitov-exam-b1-/)
      expect(task.version).toBe(1)
      expect(getExamTask(task.id)).toBe(task)
      expect(task.instruction.trim()).not.toBe('')
      expect(task.provenance).toContain('Eigener Inhalt von Sitov Academy')
    }
    expect(getExamUnit('unknown')).toBeUndefined()
    expect(getExamTask('unknown')).toBeUndefined()
  })

  it('has three distinct balanced checkpoints with separate productive probes', () => {
    const checkpoint = EXAM_MODULES[0].units.find(unit => unit.kind === 'checkpoint')!
    const groups = [checkpoint.tasks, ...(checkpoint.variants ?? [])]
    expect(groups).toHaveLength(3)
    const ids = new Set<string>()
    const sources = new Set<string>()
    for (const group of groups) {
      const decisions = group.filter(closed)
      expect(decisions).toHaveLength(10)
      expect(decisions.filter(task => task.skill === 'listening')).toHaveLength(5)
      expect(decisions.filter(task => task.skill === 'reading')).toHaveLength(5)
      expect(group.filter(task => task.type === 'writing')).toHaveLength(1)
      expect(group.filter(task => task.type === 'speaking')).toHaveLength(1)
      for (const task of group) {
        expect(ids.has(task.id)).toBe(false)
        ids.add(task.id)
        expect(task.hints).toEqual([])
      }
      sources.add(group.find(task => task.audio)?.audio?.id ?? '')
      sources.add(group.find(task => task.image)?.image?.id ?? '')
    }
    expect(sources.size).toBe(6)
    const ordinaryImages = new Set(studentUnits.filter(unit => unit.kind !== 'checkpoint').flatMap(unit => unit.tasks).map(task => task.image?.id).filter(Boolean))
    for (const group of groups) {
      const image = group.find(task => task.image)!.image!
      expect(image.id).toMatch(/^sitov-exam-check-/)
      expect(ordinaryImages.has(image.id)).toBe(false)
    }
  })

  it('reserves a fresh recovery route without changing the ten core units or frozen audio', () => {
    const pilot = EXAM_MODULES[0]
    expect(pilot.units).toHaveLength(10)
    expect(pilot.fallbackUnits).toHaveLength(2)
    const [practice, transfer] = pilot.fallbackUnits!
    expect(practice.id).toBe('sitov-exam-b1-m01-f01')
    expect(transfer.id).toBe('sitov-exam-b1-m01-f02')
    expect(practice.tasks.filter(closed)).toHaveLength(3)
    expect(transfer.tasks.filter(closed)).toHaveLength(1)
    expect(transfer.tasks.filter(task => task.type === 'writing')).toHaveLength(1)
    for (const unit of pilot.fallbackUnits!) {
      expect(getExamUnit(unit.id)).toBe(unit)
      for (const task of unit.tasks) {
        expect(studentTasks.some(ordinary => ordinary.id === task.id)).toBe(false)
        expect(task.audio).toBeUndefined()
        expect(task.releaseStatus).toBe('published')
        expect(getExamTask(task.id)).toBe(task)
      }
    }
  })

  it('has complete fixed keys for closed published tasks and rubrics for open production', () => {
    for (const task of studentTasks.filter(task => task.releaseStatus !== 'draft')) {
      if (closed(task)) {
        expect(task.correctAnswer).toBeDefined()
        expect(task.explanation?.trim()).toBeTruthy()
        expect(task.evidence?.trim()).toBeTruthy()
      } else {
        expect(task.rubric?.length).toBeGreaterThan(0)
        expect(task.correctAnswer).toBeUndefined()
      }
      if (task.options) {
        expect(new Set(task.options.map(option => option.id)).size).toBe(task.options.length)
        expect(new Set(task.options.map(option => option.text)).size).toBe(task.options.length)
      }
      if (task.type === 'choice' || task.type === 'true-false') {
        expect(task.options?.some(option => option.id === task.correctAnswer)).toBe(true)
      }
      if (task.type === 'matching') {
        expect(task.correctAnswer).toHaveLength(task.prompts!.length)
        for (const answer of task.correctAnswer as string[]) {
          expect(task.options?.some(option => option.id === answer)).toBe(true)
        }
      }
      if (task.type === 'ordering') {
        expect(new Set(task.correctAnswer as string[])).toEqual(new Set(task.options!.map(option => option.id)))
      }
    }
    expect(new Set(studentTasks.map(task => task.type))).toEqual(new Set(['choice', 'true-false', 'matching', 'ordering', 'short-text', 'writing', 'speaking']))
  })

  it('matches every Qwen task exactly to the local authoring manifest and keeps it unpublished', () => {
    const referenced = new Set<string>()
    for (const task of studentTasks.filter(task => task.audio?.route === 'qwen')) {
      const audio = task.audio!
      expect(audio.script).toBe((manifest as Record<string, string>)[audio.id])
      expect(audio.status).toBe('awaiting_recording')
      expect(task.releaseStatus).toBe('awaiting_media')
      expect(audio.src).toBeUndefined()
      expect(audio.roles).toEqual(['Männlicher Sprecher'])
      referenced.add(audio.id)
    }
    // The welcome text is supplied for authoring but the orientation uses its written version.
    expect(new Set(Object.keys(manifest))).toEqual(new Set([...referenced, 'sitov-exam-b1-m01-welcome-v1']))
  })

  it('quotes an actual source passage for every sourced closed question', () => {
    for (const task of EXAM_TASKS.filter(task => task.releaseStatus !== 'draft' && closed(task))) {
      const source = task.audio?.script ?? task.text
      if (source) expect(source).toContain(task.evidence)
    }
  })

  it('keeps all human orders paired with real-word alignment input and media-gated questions', () => {
    expect(EXAM_AUDIO_ORDERS).toHaveLength(8)
    expect(EXAM_RECORDING_SESSIONS).toHaveLength(3)
    for (const order of EXAM_AUDIO_ORDERS) {
      expect(order.status).toBe('awaiting_recording')
      expect(order.route).toBe('human')
      expect(order.script.length).toBeGreaterThan(order.spokenText.length)
      expect(order.spokenText.startsWith(`${order.script.split(':')[0]}:`)).toBe(false)
      expect(order.tasks).toHaveLength(order.solutions.length)
      expect(order.tasks.map(task => task.id)).toEqual(order.taskIds)
      expect(order.productionSteps).toHaveLength(8)
      expect(EXAM_RECORDING_SESSIONS.find(session => session.id === order.session)?.audioIds).toContain(order.audioId)
      for (const task of order.tasks) {
        expect(task.audio?.script).toBe(order.spokenText)
        expect(task.audio?.status).toBe('awaiting_recording')
        expect(task.releaseStatus).toBe('awaiting_media')
        const solution = order.solutions.find(solution => solution.taskId === task.id)!
        expect(solution.answer).toEqual(task.correctAnswer)
        expect(solution.evidence).toBe(task.evidence)
      }
    }
    expect(EXAM_PRACTICE_MODULES).toHaveLength(1)
    expect(EXAM_PRACTICE_MODULES[0].units).toHaveLength(8)
    for (const unit of EXAM_PRACTICE_MODULES[0].units) {
      expect(unit.required).toBe(false)
      expect(getExamUnit(unit.id)).toBe(unit)
      expect(unit.tasks.every(task => task.releaseStatus === 'awaiting_media')).toBe(true)
    }
  })

  it('contains German-only B1 tasks and exclusively male fictional scene roles', () => {
    for (const task of studentTasks) {
      expect(task.profiles).toContain('general_b1')
      expect(task.instruction).not.toMatch(/translate|перевед|çevir|Übersetz/i)
      expect(task.image?.alt ?? '').not.toMatch(/Frau|Mädchen|Nachbarin|Lehrerin|Teilnehmerin/)
      expect(task.audio?.roles.join(' ') ?? '').not.toMatch(/weiblich|Frau |Kundin|Sprecherin/)
      if (task.image) expect(existsSync(join(process.cwd(), 'public', task.image.src))).toBe(true)
    }
  })
})
