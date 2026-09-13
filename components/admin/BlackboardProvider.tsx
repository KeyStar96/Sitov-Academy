'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { saveBlackboardNote } from '@/app/actions/teacher-notes'
import {
  displayBlackboardNote, type TeacherStudentNote,
} from '@/lib/types/teacher-notes'

export type BlackboardSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface BoardDraft {
  noteId: string | null
  noteText: string
  status: BlackboardSaveStatus
}

function fromNote(note: TeacherStudentNote | null): BoardDraft {
  return {
    noteId: note?.id ?? null,
    noteText: displayBlackboardNote(note?.note_text),
    status: 'idle',
  }
}

interface BlackboardContextValue {
  getBoard: (studentId: string) => BoardDraft
  setNoteText: (studentId: string, noteText: string) => void
  retrySave: (studentId: string) => void
}

const BlackboardContext = createContext<BlackboardContextValue | null>(null)
const SAVE_DELAY_MS = 700

export function BlackboardProvider({
  initialNotes, children,
}: {
  initialNotes: Record<string, TeacherStudentNote>
  children: ReactNode
}) {
  const [boards, setBoards] = useState<Record<string, BoardDraft>>(() => {
    const initial: Record<string, BoardDraft> = {}
    for (const [studentId, note] of Object.entries(initialNotes)) initial[studentId] = fromNote(note)
    return initial
  })
  const boardsRef = useRef(boards)
  const confirmedRef = useRef<Record<string, BoardDraft>>({ ...boards })
  const queuedRef = useRef<Record<string, { noteText: string }>>({})
  const runningRef = useRef<Record<string, boolean>>({})
  const timersRef = useRef<Record<string, number>>({})
  const mountedRef = useRef(true)

  useEffect(() => {
    boardsRef.current = boards
  }, [boards])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const ensureBoard = useCallback((studentId: string): BoardDraft => {
    return boardsRef.current[studentId] ?? fromNote(initialNotes[studentId] ?? null)
  }, [initialNotes])

  const drain = useCallback(async (studentId: string) => {
    if (runningRef.current[studentId]) return
    runningRef.current[studentId] = true
    try {
      while (queuedRef.current[studentId]) {
        const draft = queuedRef.current[studentId]
        delete queuedRef.current[studentId]
        const previous = confirmedRef.current[studentId] ?? fromNote(initialNotes[studentId] ?? null)
        if (mountedRef.current) {
          setBoards(current => ({
            ...current,
            [studentId]: { ...(current[studentId] ?? previous), status: 'saving' },
          }))
        }
        const result = await saveBlackboardNote({
          student_id: studentId,
          note_id: previous.noteId,
          note_text: draft.noteText,
        })
        if (result.success === false) {
          delete queuedRef.current[studentId]
          if (mountedRef.current) {
            setBoards(current => ({
              ...current,
              [studentId]: { ...(current[studentId] ?? previous), status: 'error' },
            }))
          }
          confirmedRef.current[studentId] = previous
          break
        }
        const saved = fromNote(result.data)
        saved.status = 'saved'
        confirmedRef.current[studentId] = saved
        if (mountedRef.current && !queuedRef.current[studentId]) {
          setBoards(current => {
            const live = current[studentId]
            if (!live) return { ...current, [studentId]: saved }
            return {
              ...current,
              [studentId]: {
                ...saved,
                noteText: live.noteText,
                status: 'saved',
              },
            }
          })
        }
      }
    } catch {
      // A rejected action must keep the teacher's unsaved text available for retry.
      delete queuedRef.current[studentId]
      if (mountedRef.current) {
        setBoards(current => ({
          ...current,
          [studentId]: { ...(current[studentId] ?? fromNote(initialNotes[studentId] ?? null)), status: 'error' },
        }))
      }
    } finally {
      runningRef.current[studentId] = false
      if (queuedRef.current[studentId]) void drain(studentId)
    }
  }, [initialNotes])

  const schedule = useCallback((studentId: string, noteText: string) => {
    queuedRef.current[studentId] = { noteText }
    const existing = timersRef.current[studentId]
    if (existing) window.clearTimeout(existing)
    timersRef.current[studentId] = window.setTimeout(() => {
      delete timersRef.current[studentId]
      void drain(studentId)
    }, SAVE_DELAY_MS)
  }, [drain])

  const setNoteText = useCallback((studentId: string, noteText: string) => {
    const current = ensureBoard(studentId)
    const next = { ...current, noteText, status: 'idle' as const }
    setBoards(boards => ({ ...boards, [studentId]: next }))
    schedule(studentId, noteText)
  }, [ensureBoard, schedule])

  const getBoard = useCallback((studentId: string) => {
    return boards[studentId] ?? fromNote(initialNotes[studentId] ?? null)
  }, [boards, initialNotes])

  const retrySave = useCallback((studentId: string) => {
    const current = ensureBoard(studentId)
    if (current.status !== 'error') return
    setBoards(boards => ({ ...boards, [studentId]: { ...current, status: 'saving' } }))
    schedule(studentId, current.noteText)
  }, [ensureBoard, schedule])

  return (
    <BlackboardContext.Provider value={{ getBoard, setNoteText, retrySave }}>
      {children}
    </BlackboardContext.Provider>
  )
}

export function useBlackboard() {
  const value = useContext(BlackboardContext)
  if (!value) throw new Error('useBlackboard requires BlackboardProvider')
  return value
}
