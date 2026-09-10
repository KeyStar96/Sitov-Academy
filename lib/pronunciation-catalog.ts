import readingTexts from '@/supabase/seeds/pronunciation-reading-2026.json'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import {
  cefrFamilyFromLevel,
  type CefrFamily,
  type PronunciationPrompt,
} from '@/lib/pronunciation-prompts'

/**
 * Eingebauter Satzvorrat des Aussprache-Trainers.
 *
 * Die Datenbank kann Sätze ergänzen oder mit `audio_url` überschreiben.
 * Dieser Katalog garantiert, dass jedes freigeschaltete Niveau (A1.1–B1.2)
 * und jede CEFR-Familie (A1–C2) eigene, zum Stand passende Sätze hat.
 */

interface CatalogRow {
  sentenceDe: string
  focus: string
}

function makePrompts(levelKey: string, cefrLevel: CefrFamily, rows: readonly CatalogRow[]): PronunciationPrompt[] {
  return rows.map((row, index) => ({
    id: `catalog:${levelKey}:${index + 1}`,
    cefrLevel,
    sentenceDe: row.sentenceDe,
    focus: row.focus,
    audioUrl: null,
    sortOrder: index + 1,
  }))
}

const A1_1: readonly CatalogRow[] = [
  { sentenceDe: 'Guten Tag, ich heiße Anna.', focus: 'ie, ch' },
  { sentenceDe: 'Ich komme aus Hannover.', focus: 'kommen, aus' },
  { sentenceDe: 'Das ist mein Freund.', focus: 'eu, nd' },
  { sentenceDe: 'Ich trinke gerne Kaffee.', focus: 'r, ä' },
  { sentenceDe: 'Eins, zwei, drei, vier.', focus: 'ei, z' },
  { sentenceDe: 'Ich bin müde.', focus: 'ü' },
  { sentenceDe: 'Wie geht es Ihnen?', focus: 'ie, ch' },
  { sentenceDe: 'Danke schön!', focus: 'sch, ö' },
  { sentenceDe: 'Wo ist die Toilette?', focus: 'ie, tt' },
  { sentenceDe: 'Ich heiße Jürgen.', focus: 'ü, ei' },
]

const A1_2: readonly CatalogRow[] = [
  { sentenceDe: 'Wo ist der Bahnhof, bitte?', focus: 'ch, hof' },
  { sentenceDe: 'Heute ist das Wetter schön.', focus: 'ö, eu' },
  { sentenceDe: 'Ich habe zwei Brüder.', focus: 'ü, zwei' },
  { sentenceDe: 'Entschuldigung, wie spät ist es?', focus: 'sch, ä' },
  { sentenceDe: 'Ich kaufe Brot, Milch und Käse.', focus: 'au, ch' },
  { sentenceDe: 'Wir wohnen in einer kleinen Wohnung.', focus: 'ö, w' },
  { sentenceDe: 'Kannst du das bitte wiederholen?', focus: 'ie, ö' },
  { sentenceDe: 'Meine Schwester spricht Deutsch.', focus: 'sch, ch' },
  { sentenceDe: 'Der Apfel ist süß und rot.', focus: 'pf, ü' },
  { sentenceDe: 'Ich möchte einen Tee, bitte.', focus: 'ö, ch' },
]

const A2_1: readonly CatalogRow[] = [
  { sentenceDe: 'Gestern war ich mit meiner Freundin im Park.', focus: 'war, r' },
  { sentenceDe: 'Kannst du mir bitte helfen?', focus: 'st, pf' },
  { sentenceDe: 'Ich kaufe Brot, Milch und Äpfel.', focus: 'ä, pf' },
  { sentenceDe: 'Am Wochenende besuche ich meine Eltern.', focus: 'ch, wo' },
  { sentenceDe: 'Der Zug hat zehn Minuten Verspätung.', focus: 'z, ä' },
  { sentenceDe: 'Ich stehe um sieben Uhr auf.', focus: 'st, ie' },
  { sentenceDe: 'Im Sommer fahren wir an die Ostsee.', focus: 'mm, ee' },
  { sentenceDe: 'Hast du Lust auf einen Spaziergang?', focus: 'st, z' },
  { sentenceDe: 'Die Küche ist hell und freundlich.', focus: 'ü, ch' },
  { sentenceDe: 'Wir treffen uns nach der Arbeit.', focus: 'ff, ei' },
]

const A2_2: readonly CatalogRow[] = [
  { sentenceDe: 'Wir treffen uns um halb vier vor dem Kino.', focus: 'pf, v' },
  { sentenceDe: 'Meine Wohnung liegt ganz in der Nähe.', focus: 'ö, ch' },
  { sentenceDe: 'Ich möchte einen Termin beim Arzt machen.', focus: 'ö, ch' },
  { sentenceDe: 'Könntest du das Fenster zumachen?', focus: 'ö, ch' },
  { sentenceDe: 'Trotz des Regens gehen wir spazieren.', focus: 'z, z' },
  { sentenceDe: 'Ich habe gestern einen interessanten Film gesehen.', focus: 'g, ie' },
  { sentenceDe: 'Nächste Woche besuchen wir unsere Großeltern.', focus: 'ch, ß' },
  { sentenceDe: 'Sie spricht schnell, aber sehr deutlich.', focus: 'ch, eu' },
  { sentenceDe: 'Das Frühstück schmeckt besonders gut.', focus: 'ü, sch' },
  { sentenceDe: 'Bitte sprechen Sie etwas langsamer.', focus: 'ch, er' },
]

const B1_1: readonly CatalogRow[] = [
  { sentenceDe: 'Ich bin der Meinung, dass Sport den Alltag erleichtert.', focus: 'ng, ch' },
  { sentenceDe: 'Letztes Jahr habe ich zum ersten Mal allein verreist.', focus: 'z, ei' },
  { sentenceDe: 'Es fällt mir schwer, vor vielen Menschen zu sprechen.', focus: 'sch, ch' },
  { sentenceDe: 'Die Nachbarin hat uns freundlich begrüßt.', focus: 'ü, ch' },
  { sentenceDe: 'Ich habe mich über die Nachricht sehr gefreut.', focus: 'ü, eu' },
  { sentenceDe: 'Weil ich krank war, habe ich den Kurs verpasst.', focus: 'ei, st' },
  { sentenceDe: 'Manchmal fällt es mir schwer, ruhig zu bleiben.', focus: 'ch, ei' },
  { sentenceDe: 'Wir haben uns lange über das Thema unterhalten.', focus: 'th, h' },
  { sentenceDe: 'Ich versuche, jeden Tag ein bisschen Deutsch zu sprechen.', focus: 'ch, ü' },
  { sentenceDe: 'Die Aussprache übe ich am liebsten laut vor dem Spiegel.', focus: 'ss, ü' },
]

const B1_2: readonly CatalogRow[] = [
  { sentenceDe: 'Wenn ich Zeit hätte, würde ich öfter ins Theater gehen.', focus: 'ö, ü' },
  { sentenceDe: 'Könntest du das bitte noch einmal wiederholen?', focus: 'ö, ie' },
  { sentenceDe: 'Trotz des Regens sind wir spazieren gegangen.', focus: 'z, sp' },
  { sentenceDe: 'Es wäre schön, wenn wir uns nächste Woche treffen könnten.', focus: 'ä, ö' },
  { sentenceDe: 'Ich würde vorschlagen, die Übung noch einmal zu machen.', focus: 'ü, sch' },
  { sentenceDe: 'Eigentlich wollte ich widersprechen, aber mir fehlten die Worte.', focus: 'ch, ei' },
  { sentenceDe: 'Je genauer man zuhört, desto besser versteht man die Melodie.', focus: 'au, ie' },
  { sentenceDe: 'Nach der Prüfung fühle ich mich erleichtert und müde.', focus: 'ü, ch' },
  { sentenceDe: 'Man sollte nicht voreilig urteilen, bevor alle Fakten da sind.', focus: 'ei, g' },
  { sentenceDe: 'Die Aussprache klappt besser, wenn man langsam und klar spricht.', focus: 'ch, a' },
]

const B2_ROWS: readonly CatalogRow[] = [
  { sentenceDe: 'Es kommt darauf an, wie gründlich man sich vorbereitet.', focus: 'ü, ch' },
  { sentenceDe: 'Die Diskussion hat gezeigt, dass beide Seiten berechtigte Einwände haben.', focus: 'sch, ä' },
  { sentenceDe: 'Ich würde vorschlagen, die Entscheidung um eine Woche zu verschieben.', focus: 'sch, ie' },
  { sentenceDe: 'Eigentlich wollte ich widersprechen, aber mir fehlten die Worte.', focus: 'ch, ei' },
  { sentenceDe: 'Der Vortrag war zwar anspruchsvoll, aber äußerst lehrreich.', focus: 'äu, ch' },
  { sentenceDe: 'Man sollte nicht voreilig urteilen, bevor alle Fakten vorliegen.', focus: 'ei, g' },
  { sentenceDe: 'Inzwischen hat sich die Lage deutlich entspannt.', focus: 'z, sch' },
  { sentenceDe: 'Es wäre wünschenswert, wenn wir uns auf einen Kompromiss einigen könnten.', focus: 'ü, ss' },
  { sentenceDe: 'Die Betonung verschiebt die Bedeutung oft um eine ganze Nuance.', focus: 'ö, z' },
  { sentenceDe: 'Wer bewusst artikuliert, wird auch in schwierigen Sätzen verstanden.', focus: 'z, ch' },
]

const C1_ROWS: readonly CatalogRow[] = [
  { sentenceDe: 'Die These, dass Sprache unser Denken formt, ist keineswegs neu.', focus: 's, z' },
  { sentenceDe: 'Es bedarf einer differenzierten Betrachtung, um vorschnelle Schlüsse zu vermeiden.', focus: 'z, sch' },
  { sentenceDe: 'Ungeachtet aller Einwände bleibt die Kernaussage überzeugend.', focus: 'ä, z' },
  { sentenceDe: 'Die Nuancen der deutschen Satzmelodie entscheiden über Höflichkeit und Distanz.', focus: 'z, ch' },
  { sentenceDe: 'Ein präziser Wortschatz ersetzt mitunter ganze Erklärungen.', focus: 'z, ch' },
  { sentenceDe: 'Sie argumentierte schlüssig, ohne den Gegenüber bloßzustellen.', focus: 'sch, ü' },
  { sentenceDe: 'Die Ironie lag weniger im Inhalt als im Tonfall.', focus: 'ie, f' },
  { sentenceDe: 'Wer Widersprüche aushält, gewinnt an sprachlicher Souveränität.', focus: 'ch, ä' },
  { sentenceDe: 'Die Prosodie trägt oft mehr Bedeutung als das einzelne Lexem.', focus: 's, ie' },
  { sentenceDe: 'Ein geübtes Ohr hört den Unterschied zwischen Distanz und Wärme.', focus: 'ü, ä' },
]

const C2_ROWS: readonly CatalogRow[] = [
  { sentenceDe: 'Die feinen Registerwechsel zwischen Amtsdeutsch und Umgangssprache verlangen ein sicheres Gespür.', focus: 'sch, ü' },
  { sentenceDe: 'Selbst flüchtige Alliterationen können einem Satz Gewicht verleihen.', focus: 'fl, tz' },
  { sentenceDe: 'Es ist bezeichnend, wie ein einziges Modalpartikel den ganzen Satz kippt.', focus: 'ch, z' },
  { sentenceDe: 'Zwischen Understatement und Übertreibung liegt die Kunst der Nuance.', focus: 'ü, z' },
  { sentenceDe: 'Die Prosodie verrät oft mehr als die gewählten Lexeme.', focus: 's, ie' },
  { sentenceDe: 'Ein geübtes Ohr unterscheidet Ironie von bloßer Höflichkeit im Bruchteil einer Sekunde.', focus: 'ü, ch' },
  { sentenceDe: 'Sprachliche Eleganz entsteht, wo Präzision und Rhythmus einander tragen.', focus: 'z, ch' },
  { sentenceDe: 'Wer Stil beherrscht, kann auch Schweigen beredt machen.', focus: 'sch, ch' },
  { sentenceDe: 'Die Kunst liegt darin, schwere Laute leicht und leichte Laute gewichtig zu sprechen.', focus: 'ch, ei' },
  { sentenceDe: 'Nur wer die Satzmelodie beherrscht, klingt wirklich idiomatisch.', focus: 'ch, t' },
]

const BY_ACCESS_LEVEL: Record<(typeof ACCESS_LEVELS)[number], PronunciationPrompt[]> = {
  'A1.1': makePrompts('A1.1', 'A1', A1_1),
  'A1.2': makePrompts('A1.2', 'A1', A1_2),
  'A2.1': makePrompts('A2.1', 'A2', A2_1),
  'A2.2': makePrompts('A2.2', 'A2', A2_2),
  'B1.1': makePrompts('B1.1', 'B1', B1_1),
  'B1.2': makePrompts('B1.2', 'B1', B1_2),
}

function concatFamily(family: CefrFamily, first: readonly CatalogRow[], second: readonly CatalogRow[]): PronunciationPrompt[] {
  const head = makePrompts(family, family, first)
  const tail = makePrompts(`${family}-extra`, family, second).map((prompt) => ({
    ...prompt,
    sortOrder: prompt.sortOrder + first.length,
  }))
  return [...head, ...tail]
}

const BY_FAMILY: Record<CefrFamily, PronunciationPrompt[]> = {
  A1: concatFamily('A1', A1_1, A1_2),
  A2: concatFamily('A2', A2_1, A2_2),
  B1: concatFamily('B1', B1_1, B1_2),
  B2: makePrompts('B2', 'B2', B2_ROWS),
  C1: makePrompts('C1', 'C1', C1_ROWS),
  C2: makePrompts('C2', 'C2', C2_ROWS),
}

/** Sätze für ein Routen-Niveau (A1.1) oder eine CEFR-Familie (B2). */
export function getCatalogPrompts(level: string): PronunciationPrompt[] {
  const trimmed = level.trim()
  if ((ACCESS_LEVELS as readonly string[]).includes(trimmed)) {
    return readingTexts.filter((row) => row.level === trimmed).map((row) => ({ id: row.id, title: row.title, level: row.level, cefrLevel: cefrFamilyFromLevel(row.level)!, sentenceDe: row.text, focus: row.focus, audioUrl: null, sortOrder: row.sortOrder }))
  }

  const family = cefrFamilyFromLevel(trimmed)
  if (!family) return []
  return BY_FAMILY[family]
}

/**
 * Katalog ist die Basis. Datenbanksätze mit gleichem Wortlaut liefern
 * echte IDs und optionale Audio-URLs; zusätzliche DB-Sätze hängen hinten an.
 */
export function mergePronunciationPrompts(
  catalog: readonly PronunciationPrompt[],
  fromDb: readonly PronunciationPrompt[]
): PronunciationPrompt[] {
  const merged = new Map<string, PronunciationPrompt>()
  for (const prompt of catalog) {
    merged.set(prompt.sentenceDe, prompt)
  }

  const extras: PronunciationPrompt[] = []
  for (const prompt of fromDb) {
    const existing = merged.get(prompt.sentenceDe)
    if (existing) {
      merged.set(prompt.sentenceDe, {
        ...existing,
        id: prompt.id,
        audioUrl: prompt.audioUrl ?? existing.audioUrl,
        focus: prompt.focus ?? existing.focus,
      })
    } else {
      extras.push(prompt)
    }
  }

  return [...merged.values(), ...extras]
}
