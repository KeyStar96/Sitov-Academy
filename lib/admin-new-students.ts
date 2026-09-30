import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import { readAllRows } from '@/lib/supabase-read'

export interface UnassignedStudentRef {
  id: string
  created_at: string | null
  native_language: string | null
}

/**
 * „Neue Schüler“: Konten mit Rolle `student`, die noch KEINE Niveau-Freigabe
 * (`student_level_access`) besitzen. Genau diese Personen müssen Lehrkräfte
 * einem Trainer-Niveau zuordnen, bevor die Lernbereiche nutzbar sind.
 *
 * Eine einzige Definition für Übersicht, Navigations-Badge und die Liste
 * „Neue Schüler“. Kursanmeldungen spielen bewusst keine Rolle: Trainer-Niveaus
 * sind eigenständig und werden nie aus einem Kurs abgeleitet.
 * Neueste Registrierungen zuerst.
 */
export async function loadUnassignedStudents(client: SupabaseClient<Database>): Promise<UnassignedStudentRef[]> {
  const [students, access] = await Promise.all([
    readAllRows<UnassignedStudentRef>((from, to) =>
      client.from('profiles').select('id,created_at,native_language').eq('role', 'student').order('id').range(from, to)),
    readAllRows<{ auth_user_id: string }>((from, to) =>
      client.from('student_level_access').select('auth_user_id').order('auth_user_id').order('level').range(from, to)),
  ])
  const withAccess = new Set(access.map(row => row.auth_user_id))
  return students
    .filter(row => !withAccess.has(row.id))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.id.localeCompare(b.id))
}

export interface NewStudentBooking {
  title: string
  kind: Database['public']['Enums']['booking_kind']
  status: Database['public']['Enums']['booking_status']
  targetMonth: string
}

export interface NewStudent {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  nativeLanguage: string | null
  registeredAt: string | null
  /** Nur Kontext für die Lehrkraft – nie Grundlage einer automatischen Freigabe. */
  bookings: NewStudentBooking[]
}

const CHUNK = 150
function chunks<T>(values: T[]): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += CHUNK) result.push(values.slice(index, index + CHUNK))
  return result
}

/** Kontakt- und Anmeldekontext zu allen neuen Schülern (lesend, begrenzt in Blöcken). */
export async function loadNewStudents(client: SupabaseClient<Database>): Promise<NewStudent[]> {
  const refs = await loadUnassignedStudents(client)
  if (!refs.length) return []
  const people = (await Promise.all(chunks(refs.map(ref => ref.id)).map(ids =>
    readAllRows<{ id: string; auth_user_id: string | null; display_name: string; email: string; phone: string | null; city: string | null }>((from, to) =>
      client.from('people').select('id,auth_user_id,display_name,email,phone,city').in('auth_user_id', ids).order('id').range(from, to)),
  ))).flat()
  const personByUser = new Map(people.filter(person => person.auth_user_id).map(person => [person.auth_user_id as string, person]))
  const bookings = people.length ? (await Promise.all(chunks(people.map(person => person.id)).map(ids =>
    readAllRows<{ id: string; person_id: string; kind: NewStudentBooking['kind']; status: NewStudentBooking['status']; target_month: string; booking_items: { title_snapshot: string }[] }>((from, to) =>
      client.from('bookings').select('id,person_id,kind,status,target_month,booking_items(title_snapshot)')
        .in('person_id', ids).neq('status', 'rejected').order('target_month', { ascending: false }).order('id').range(from, to)),
  ))).flat() : []

  return refs.map(ref => {
    const person = personByUser.get(ref.id)
    const own = person ? bookings.filter(booking => booking.person_id === person.id) : []
    const seen = new Set<string>()
    const courseBookings: NewStudentBooking[] = []
    for (const booking of own) {
      for (const item of booking.booking_items ?? []) {
        const key = `${item.title_snapshot}:${booking.kind}`
        if (seen.has(key)) continue
        seen.add(key)
        courseBookings.push({ title: item.title_snapshot, kind: booking.kind, status: booking.status, targetMonth: booking.target_month })
      }
    }
    return {
      id: ref.id,
      name: person?.display_name?.trim() ?? '',
      email: person?.email ?? null,
      phone: person?.phone ?? null,
      city: person?.city ?? null,
      nativeLanguage: ref.native_language,
      registeredAt: ref.created_at,
      bookings: courseBookings,
    }
  })
}
