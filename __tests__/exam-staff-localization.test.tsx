import React from 'react'
import { readFileSync } from 'node:fs'
import * as ts from 'typescript'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import ExamSimulationTeacher from '@/components/exam-simulation/ExamSimulationTeacher'
import ExamTeacherPanel from '@/components/exam-preparation/ExamTeacherPanel'
import ExamAudioProductionPanel from '@/components/exam-preparation/ExamAudioProductionPanel'
import { EXAM_AUDIO_ORDERS, EXAM_MODULES, EXAM_RECORDING_SESSIONS } from '@/lib/exam-preparation/content'
import { hasSitovTeacherTranslation, sitovTeacherText, sitovTeacherError } from '@/lib/exam-simulation/teacher-ui-copy'
import { hasSitovPrepTeacherTranslation, sitovPrepTeacherText, sitovPrepTeacherError } from '@/lib/exam-preparation/teacher-ui-copy'
import simulationMessages from '@/lib/exam-simulation/teacher-ui-translations.json'
import prepMessages from '@/lib/exam-preparation/teacher-ui-translations.json'
import type { SimulationTeacherState } from '@/lib/exam-simulation/server'
import type { ExamSubmission } from '@/lib/exam-preparation/types'

jest.mock('server-only', () => ({}), { virtual: true })
jest.unmock('lucide-react')
jest.mock('@/app/actions/exam-simulation', () => ({ getSimulationTeacherState: jest.fn(), reviewExamSimulationTask: jest.fn(), grantSimulationLevel: jest.fn(), grantSimulationFeature: jest.fn(), resetStudentSimulationProgress: jest.fn(), sitovAssignSimulationStudent: jest.fn() }))
jest.mock('@/app/actions/exam-preparation', () => ({ reviewExamSubmission: jest.fn(), unlockExamModule: jest.fn(), assignExamTeacher: jest.fn() }))
jest.mock('@/app/actions/exam-audio-production', () => ({ createExamProductionUpload: jest.fn(), completeExamProductionUpload: jest.fn(), setExamProductionStatus: jest.fn() }))
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))

const languages = ['de','en','ru','uk','tr'] as const
const teacherState: SimulationTeacherState = { success: true, actorRole: 'teacher', students: [{id:'max', name:'Max'}], unassignedStudents:[{id:'daniel',name:'Daniel'}], runs:[], teachers:[], assignments:[], featureGrants:[], levelGrants:[] }
const writingTask = EXAM_MODULES.flatMap(module => module.units.flatMap(unit => unit.tasks)).find(task => task.type === 'writing')!
const submission: ExamSubmission = { id:'submission',studentId:'max',taskId:writingTask.id,taskVersion:writingTask.version,unitId:'unit',kind:'writing',text:'Guten Tag, ich komme am Freitag.',mediaPath:null,mediaUrl:null,teacherId:null,status:'submitted',previousId:null,helped:false,reflection:null,createdAt:'2026-10-04T10:00:00Z',feedback:[] }

afterEach(cleanup)

it.each(languages)('renders %s staff access and name-confirmed reset without changing learner identifiers', lang => {
  const t = (text:string, values?:Record<string,string|number>) => sitovTeacherText(lang,text,values)
  render(<ExamSimulationTeacher lang={lang} initial={teacherState} />)
  expect(screen.getByRole('button',{name:t('Freigaben')})).toHaveAttribute('aria-pressed','true')
  expect(screen.getByRole('button',{name:t('Prüfung für {name} freigeben',{name:'Max'})})).toBeEnabled()
  expect(screen.getByRole('button',{name:t('{level} freigeben',{level:'B2'})})).toBeDisabled()
  fireEvent.change(screen.getByLabelText(t('Lernende suchen')),{target:{value:'DAN'}})
  expect(screen.getByLabelText(t('Teilnehmender ohne Prüfungslehrkraft'))).toHaveValue('daniel')
  expect(screen.getByRole('button',{name:t('Übernehmen und für {name} freigeben',{name:'Daniel'})})).toBeEnabled()
  fireEvent.click(screen.getByRole('button',{name:t('Reset für {name} vorbereiten',{name:'Max'})}))
  const reset = screen.getByRole('button',{name:t('Prüfungsfortschritt von {name} endgültig löschen',{name:'Max'})})
  expect(reset).toBeDisabled()
  fireEvent.change(screen.getByLabelText(t('Name zur Reset-Bestätigung')),{target:{value:'Max'}})
  expect(reset).toBeEnabled()
})

it.each(languages)('renders %s preparation review with the exact German task and original answer', lang => {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
  render(<ExamTeacherPanel lang={lang} modules={EXAM_MODULES} state={{success:true, actorRole:'teacher',students:[{id:'max',name:'Max',course:null}],assignments:[],submissions:[submission]}} />)
  expect(screen.getByLabelText(t('Status'))).toHaveValue('submitted')
  fireEvent.click(screen.getByRole('button',{name:/Max/}))
  expect(screen.getByText(writingTask.instruction)).toHaveAttribute('lang','de')
  expect(screen.getByText(writingTask.instruction)).toHaveAttribute('translate','no')
  expect(screen.getByText(submission.text)).toHaveAttribute('lang','de')
  expect(screen.getByRole('button',{name:t('Rückmeldung speichern')})).toBeEnabled()
  expect(screen.getByLabelText(new RegExp('^'+t('Lernstatus dieser Leistung')))).toHaveValue('practice')
})

it.each(languages)('renders %s recording administration while protecting the German script and solutions', lang => {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
  const order = EXAM_AUDIO_ORDERS[0]
  render(<ExamAudioProductionPanel lang={lang} orders={EXAM_AUDIO_ORDERS} sessions={EXAM_RECORDING_SESSIONS} state={{success:true, productions:[]}} />)
  fireEvent.click(screen.getByRole('button',{name:new RegExp(t(order.title))}))
  expect(screen.getByText(order.script)).toHaveAttribute('lang','de')
  expect(screen.getByText(order.script)).toHaveAttribute('translate','no')
  expect(screen.getByText(t(order.learningGoal))).toBeVisible()
  fireEvent.click(screen.getByText(new RegExp(t('Aufgaben, Lösungen und Belegstellen (').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))))
  expect(screen.getByText(order.tasks[0].instruction)).toHaveAttribute('lang','de')
  fireEvent.click(screen.getByRole('button',{name:t('2. Dateien')}))
  expect(screen.getByLabelText(new RegExp(t('Schnittdatei auswählen oder ersetzen')))).toBeDisabled()
})

it('has complete staff copy, stable interpolation and no untranslated catalog-production guidance', () => {
  for (const dictionary of [simulationMessages,prepMessages]) for (const [source,values] of Object.entries(dictionary)) {
    expect(values).toHaveLength(5)
    const placeholders = source.match(/\{\w+\}/g) ?? []
    values.forEach(value => {
      expect(value.trim()).not.toBe('')
      expect(value.match(/\{\w+\}/g) ?? []).toEqual(placeholders)
    })
  }
  const productionCopy = EXAM_AUDIO_ORDERS.flatMap(order => [order.title,order.learningGoal,order.profileScope,order.targetDuration,order.notes,...order.roles,...order.productionSteps])
  const sessionCopy = EXAM_RECORDING_SESSIONS.flatMap(session => [session.title,session.duration,...session.steps])
  for (const source of [...productionCopy,...sessionCopy]) expect(hasSitovPrepTeacherTranslation(source)).toBe(true)
  for (const lang of languages.filter(lang => lang !== 'de')) {
    expect(sitovTeacherError(lang,'Unbekannter Datenbankfehler')).not.toContain('Unbekannter')
    expect(sitovPrepTeacherError(lang,'Unbekannter Datenbankfehler')).not.toContain('Unbekannter')
  }
})

it('covers every explicit staff translation key and keeps new German JSX prose out of the outer UI', () => {
  const files = [
    ['components/exam-simulation/ExamSimulationTeacher.tsx',hasSitovTeacherTranslation],
    ['components/exam-simulation/TeacherExamSimulationPanel.tsx',hasSitovTeacherTranslation],
    ['components/exam-simulation/TeacherSimulationReset.tsx',hasSitovTeacherTranslation],
    ['components/exam-preparation/ExamTeacherPanel.tsx',hasSitovPrepTeacherTranslation],
    ['components/exam-preparation/ExamAudioProductionPanel.tsx',hasSitovPrepTeacherTranslation],
    ['app/[lang]/admin/exam-preparation/page.tsx',hasSitovPrepTeacherTranslation],
  ] as const
  for (const [file,hasTranslation] of files) {
    const source = ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
    const inspect = (node:ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && ts.isStringLiteral(node.arguments[0])) expect(hasTranslation(node.arguments[0].text)).toBe(true)
      if (ts.isJsxText(node)) expect(node.text.trim()).not.toMatch(/[A-Za-zÄÖÜäöüß]{3,}/)
      ts.forEachChild(node,inspect)
    }
    inspect(source)
  }
})
