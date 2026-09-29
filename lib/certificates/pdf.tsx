import path from 'node:path'
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { CertificateEligibilityPeriod } from './types'
import { groupCertificatePeriods, type CertificateSegment } from './periods'

type CertificatePdfIssue = {
  certificate_number: string
  snapshot: {
    person: { display_name: string; street: string | null; postal_code: string | null; city: string | null }
    periods: CertificateEligibilityPeriod[]
    date: string
  }
}

const FAMILY = 'CertificateNotoSans'
let fontsRegistered = false

function registerFonts() {
  if (fontsRegistered) return
  // Both paths are fixed application assets. Imported text never selects a
  // resource, URL, font, or image for the renderer to load.
  const directory = path.join(process.cwd(), 'lib', 'certificates', 'fonts')
  Font.register({
    family: FAMILY,
    fonts: [
      { src: path.join(directory, 'NotoSans-Regular.ttf'), fontWeight: 400 },
      { src: path.join(directory, 'NotoSans-Bold.ttf'), fontWeight: 700 },
    ],
  })
  fontsRegistered = true
}

// Use the font's default leading: explicit lineHeight is re-resolved during
// dynamic pagination in renderer 4.9 and can displace or hide fixed page text.
const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 10, color: '#1e293b', paddingTop: 128, paddingBottom: 65, paddingHorizontal: 49 },
  masthead: { position: 'absolute', top: 35, left: 49, right: 49 },
  mastheadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 22, fontWeight: 700, color: '#9a3412' },
  brandSubtitle: { marginTop: 5, fontSize: 8, color: '#64748b', letterSpacing: 0.4 },
  schoolAddress: { width: 220, fontSize: 8, textAlign: 'right', color: '#475569' },
  mastheadRule: { height: 2, backgroundColor: '#c2410c', marginTop: 17, marginBottom: 8 },
  documentReference: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#64748b' },
  referenceNumber: { maxWidth: 315 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 15 },
  paragraph: { marginBottom: 10 },
  recipient: { borderLeftWidth: 2, borderLeftColor: '#c2410c', paddingLeft: 12, marginTop: 1, marginBottom: 11 },
  recipientName: { fontSize: 13, fontWeight: 700 },
  recipientAddress: { fontSize: 9, color: '#475569', marginTop: 3 },
  heading: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 9 },
  period: { paddingTop: 7, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#dce2e9' },
  periodDates: { fontSize: 9, fontWeight: 700, color: '#9a3412', marginBottom: 3 },
  courseTitle: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  schedule: { fontSize: 9, color: '#475569' },
  scopeNote: { fontSize: 9, color: '#475569', marginTop: 12 },
  description: { marginBottom: 12 },
  descriptionDates: { fontSize: 8, color: '#64748b', marginBottom: 5 },
  descriptionText: { fontSize: 9.5 },
  payment: { marginTop: 14, padding: 13, backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#e2e8f0' },
  paymentHeading: { fontSize: 10, fontWeight: 700, marginBottom: 5 },
  paymentText: { fontSize: 9.5 },
  issueDate: { marginTop: 18, fontSize: 10 },
  issuer: { marginTop: 5, fontWeight: 700 },
  footerRule: { position: 'absolute', top: 793, left: 49, right: 49, height: 0.5, backgroundColor: '#cbd5e1' },
  footerReference: { position: 'absolute', top: 803, left: 49, width: 370, height: 13, fontSize: 7.5, color: '#64748b' },
  footerPage: { position: 'absolute', top: 803, right: 49, width: 105, height: 13, fontSize: 7.5, textAlign: 'right', color: '#64748b' },
})

function dateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Invalid certificate date')
  const calendarDate = new Date(`${value}T12:00:00Z`)
  if (!Number.isFinite(calendarDate.valueOf()) || calendarDate.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid certificate date')
  }
  return `${match[3]}.${match[2]}.${match[1]}`
}

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function scheduleLabels(schedule: CertificateSegment['schedule']): string[] {
  if (!Array.isArray(schedule)) return []
  const entries: { day: number; start: string; end: string }[] = []
  for (const value of schedule) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const day = value.weekday
    const start = value.start_time
    const end = value.end_time
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7 ||
      typeof start !== 'string' || typeof end !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(end)) continue
    entries.push({ day, start: start.slice(0, 5), end: end.slice(0, 5) })
  }
  entries.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  return [...new Set(entries.map(entry => `${weekdays[entry.day - 1]} von ${entry.start} bis ${entry.end} Uhr`))]
}

function descriptionGroups(segments: CertificateSegment[]) {
  const grouped = new Map<string, { title: string; description: string; dates: string[] }>()
  for (const segment of segments) {
    if (!segment.description.trim()) continue
    const key = JSON.stringify([segment.courseId, segment.title, segment.description])
    const label = `${dateLabel(segment.start)} - ${dateLabel(segment.end)}`
    const existing = grouped.get(key)
    if (existing) existing.dates.push(label)
    else grouped.set(key, { title: segment.title, description: segment.description, dates: [label] })
  }
  return [...grouped.entries()]
}

/** Render an already-authorized, immutable issue snapshot; no network resources. */
export async function renderCertificatePdf(issue: CertificatePdfIssue): Promise<Buffer> {
  registerFonts()
  const { person, periods, date } = issue.snapshot
  const issuedOn = dateLabel(date)
  const segments = groupCertificatePeriods(periods, null, date)
  if (!segments.length || !person.display_name.trim() || !issue.certificate_number.trim()) {
    throw new Error('Incomplete certificate snapshot')
  }
  const address = [person.street, [person.postal_code, person.city].filter(Boolean).join(' ')].filter(Boolean)
  const descriptions = descriptionGroups(segments)

  return renderToBuffer(
    <Document title={`Teilnahmebescheinigung ${issue.certificate_number}`} author="Sitov Academy"
      subject="Bestätigte Teilnahme an Deutsch-Sprachkursen" creator="Sitov Academy" language="de-DE">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.masthead} fixed>
          <View style={styles.mastheadRow}>
            <View><Text style={styles.brand}>Sitov Academy</Text><Text style={styles.brandSubtitle}>DEUTSCH-SPRACHKURSE</Text></View>
            <View style={styles.schoolAddress}>
              <Text>Hüttenstraße 24a</Text><Text>30165 Hannover</Text><Text>info@sitov-academy.com</Text>
            </View>
          </View>
          <View style={styles.mastheadRule} />
          <View style={styles.documentReference}>
            <Text style={styles.referenceNumber}>Bescheinigung Nr. {issue.certificate_number}</Text>
            <Text>Ausgestellt am {issuedOn}</Text>
          </View>
        </View>

        <Text style={styles.title}>Teilnahmebescheinigung</Text>
        <Text style={styles.paragraph}>Hiermit bestätigen wir die Teilnahme von</Text>
        <View style={styles.recipient} wrap={false}>
          <Text style={styles.recipientName}>{person.display_name}</Text>
          {address.map((line, index) => <Text key={index} style={styles.recipientAddress}>{line}</Text>)}
        </View>
        <Text style={styles.paragraph}>an den nachfolgend aufgeführten Deutsch-Sprachkursen unserer Sprachschule.</Text>

        <Text style={styles.heading} minPresenceAhead={70}>Bestätigte Teilnahmezeiträume</Text>
        {segments.map((segment, index) => <View key={`${segment.courseId}:${index}`} style={styles.period} wrap={false}>
          <Text style={styles.periodDates}>{dateLabel(segment.start)} - {dateLabel(segment.end)}</Text>
          <Text style={styles.courseTitle}>{segment.title}</Text>
          {scheduleLabels(segment.schedule).map(label => <Text key={label} style={styles.schedule}>{label}</Text>)}
        </View>)}
        <Text style={styles.scopeNote} orphans={2} widows={2}>Diese Bescheinigung umfasst ausschließlich die oben aufgeführten Teilnahmezeiträume.</Text>

        {descriptions.length > 0 && <>
          <Text style={styles.heading} minPresenceAhead={60}>Kursinhalt und Zielsetzung</Text>
          {descriptions.map(([key, group]) => <View key={key} style={styles.description}>
            <View wrap={false} minPresenceAhead={45}>
              <Text style={styles.courseTitle}>{group.title}</Text>
              <Text style={styles.descriptionDates}>{group.dates.join(' / ')}</Text>
            </View>
            <Text style={styles.descriptionText} orphans={3} widows={3}>{group.description}</Text>
          </View>)}
        </>}

        <View wrap={false}>
          <View style={styles.payment}>
            <Text style={styles.paymentHeading}>Kursgebühren</Text>
            <Text style={styles.paymentText}>Die Kursgebühren für die in dieser Bescheinigung aufgeführten Teilnahmezeiträume sind beglichen.</Text>
          </View>
          <Text style={styles.issueDate}>Hannover, den {issuedOn}</Text>
          <Text style={styles.issuer}>Sitov Academy</Text>
        </View>

        <View style={styles.footerRule} fixed />
        <Text style={styles.footerReference} fixed>Sitov Academy | Teilnahmebescheinigung {issue.certificate_number}</Text>
        <Text style={styles.footerPage} fixed render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
      </Page>
    </Document>,
  )
}
