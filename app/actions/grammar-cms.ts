'use server'

import { saveLearningContent, deleteLearningContent } from '@/lib/learning-writes'

import { z } from 'zod'
import { grammarQuery, mapGrammarExercise } from '@/lib/learning-catalog'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/supabase/database.types'
import { toJsonContent } from '@/lib/types/exercise'
import { grammarExerciseSchema } from '@/lib/learning-content'
import {
  grammarWriteSchema, type GrammarWriteInput, type GrammarSaveResult,
  type GrammarDeleteResult, type GrammarLoadResult, type GrammarExerciseRow,
} from '@/lib/grammar-validation'

async function requireGrammarTeacher() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('staff_required')
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (error || (data?.role !== 'admin' && data?.role !== 'teacher')) throw new Error('staff_required')
  return supabase
}

export async function getGrammarExercises(): Promise<GrammarLoadResult> {
  try {
    const supabase = await requireGrammarTeacher()
    const rows: GrammarExerciseRow[] = []
    let offset = 0
    while (true) {
      const { data, error } = await grammarQuery(supabase)
        .order('id').range(offset, offset + 999)
      if (error) throw error
      rows.push(...data.map(row => mapGrammarExercise(row)))
      if (data.length < 1000) break
      offset += 1000
    }
    return { data: rows, failed: false }
  } catch (error) {
    console.error('Grammar CMS loading failed:', error)
    return { data: [], failed: true }
  }
}

export async function saveGrammarExercise(input: GrammarWriteInput, id?: string): Promise<GrammarSaveResult> {
  const parsed = grammarWriteSchema.safeParse(input)
  if (!parsed.success || (id !== undefined && !z.uuid().safeParse(id).success)) return { success: false, error: 'invalid' }
  try {
    const supabase = await requireGrammarTeacher()
    const payload = {
      ...parsed.data, content: toJsonContent(parsed.data.content),
    }
    const data = grammarExerciseSchema.parse(await saveLearningContent(supabase, 'exercises', payload, id))
    revalidatePath('/[lang]/admin/content/exercises', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/exercises', 'page')
    return { success: true, data }
  } catch (error) {
    console.error('Grammar CMS save failed:', { id, error })
    return { success: false, error: 'failed' }
  }
}

export async function removeGrammarExercise(id: string): Promise<GrammarDeleteResult> {
  if (!z.uuid().safeParse(id).success) return { success: false }
  try {
    const supabase = await requireGrammarTeacher()
    await deleteLearningContent(supabase, 'exercises', id)
    revalidatePath('/[lang]/admin/content/exercises', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/exercises', 'page')
    return { success: true }
  } catch (error) {
    console.error('Grammar CMS delete failed:', { id, error })
    return { success: false }
  }
}
