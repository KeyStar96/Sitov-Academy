'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { saveBlackboardNote } from '@/app/actions/teacher-notes'
import {
  displayBlackboardNote, parseDiscountInput, type TeacherStudentNote,
} from '@/lib/types/teacher-notes'

export type BlackboardSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'invalid'

export interface BoardDraft {
  noteId: string | null
  noteText: string
  discount: number
  discountInput: string
  discountValid: boolean
  status: BlackboardSaveStatus
}

function fromNote(note: TeacherStudentNote | null): BoardDraft {
  const discount = note?.discount_percent ?? 0
  return {
    noteId: note?.id ?? null,
    noteText: displayBlackboardNote(note?.note_text),
    discount,
    discountInput: Number.isInteger(discount) ? String(discount) : discount.toFixed(2),
    discountValid: true,
    status: 'idle',
  }
}

interface BlackboardContextValue {
  getBoard: (studentId: string) => BoardDraft
  setNoteText: (studentId: string, noteText: string) => void
  setDiscountInput: (studentId: string, discountInput: string) => void
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
  const queuedRef = useRef<Record<string, { noteText: string; discount: number }>>({})
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
          discount_percent: draft.discount,
        })
        if (result.success === false) {
          delete queuedRef.current[studentId]
          if (mountedRef.current) {
            setBoards(current => ({
              ...current,
              [studentId]: { ...previous, status: 'error' },
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
                discountInput: live.discountInput,
                discount: live.discountValid ? live.discount : saved.discount,
                discountValid: live.discountValid,
                status: 'saved',
              },
            }
          })
        }
      }
    } finally {
      runningRef.current[studentId] = false
      if (queuedRef.current[studentId]) void drain(studentId)
    }
  }, [initialNotes])

  const schedule = useCallback((studentId: string, noteText: string, discount: number) => {
    queuedRef.current[studentId] = { noteText, discount }
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
    if (!current.discountValid) return
    schedule(studentId, noteText, current.discount)
  }, [ensureBoard, schedule])

  const setDiscountInput = useCallback((studentId: string, discountInput: string) => {
    const current = ensureBoard(studentId)
    const parsed = parseDiscountInput(discountInput)
    const next: BoardDraft = {
      ...current,
      discountInput,
      discountValid: parsed !== null,
      discount: parsed ?? current.discount,
      status: parsed === null ? 'invalid' : 'idle',
    }
    setBoards(boards => ({ ...boards, [studentId]: next }))
    if (parsed === null) return
    schedule(studentId, current.noteText, parsed)
  }, [ensureBoard, schedule])

  const getBoard = useCallback((studentId: string) => {
    return boards[studentId] ?? fromNote(initialNotes[studentId] ?? null)
  }, [boards, initialNotes])

  return (
    <BlackboardContext.Provider value={{ getBoard, setNoteText, setDiscountInput }}>
      {children}
    </BlackboardContext.Provider>
  )
}

export function useBlackboard() {
  const value = useContext(BlackboardContext)
  if (!value) throw new Error('useBlackboard requires BlackboardProvider')
  return value
}
