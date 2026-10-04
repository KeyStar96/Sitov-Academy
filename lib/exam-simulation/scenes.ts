/** Original photorealistic exam stimuli; exactly two fictional male characters. */
const sitovScenes = [
  { src: '/Bilder/exam-simulation/sitov-fahrrad-photo-v2.webp', detail: 'Ein Mechaniker und ein Kunde besprechen die Reparatur eines Fahrrads in einer Werkstatt.' },
  { src: '/Bilder/exam-simulation/sitov-wohnung-photo-v2.webp', detail: 'Ein Mann zeigt einem anderen eine leere Wohnung. Ein Schlüssel und ein Grundriss sind zu sehen.' },
  { src: '/Bilder/exam-simulation/sitov-bibliothek-photo-v2.webp', detail: 'Ein Besucher mit zwei Büchern spricht mit einem Mitarbeiter am Tresen einer Bibliothek.' },
  { src: '/Bilder/exam-preparation/sitov-contacts-photo-v2.webp', detail: 'Zwei Männer besprechen ein Blatt auf einem Tisch. Ein Mann erklärt etwas mit einer Handbewegung.' },
  { src: '/Bilder/exam-simulation/sitov-zug-photo-v2.webp', detail: 'Zwei Reisende sprechen auf einem Bahnsteig vor einem Zug. Ein Koffer und ein Fahrtticket sind sichtbar.' },
  { src: '/Bilder/exam-simulation/sitov-sport-photo-v2.webp', detail: 'Zwei Männer sprechen in einem Sportraum neben einer Matte, einer Hantel und einem Kursblatt.' },
  { src: '/Bilder/exam-simulation/sitov-ehrenamt-photo-v2.webp', detail: 'Zwei Männer sortieren Kleidung und Bücher in Kartons in einem gemeinschaftlichen Spendenraum.' },
  { src: '/Bilder/exam-simulation/sitov-amt-photo-v2.webp', detail: 'Ein Besucher spricht mit einem Mitarbeiter an einem Schreibtisch über ein Formular.' },
  { src: '/Bilder/exam-simulation/sitov-paket-photo-v2.webp', detail: 'Ein Kunde und ein Mitarbeiter sprechen an einem Paketshop-Tresen über einen Karton und einen Beleg.' },
  { src: '/Bilder/exam-preparation/sitov-neighbourhood-photo-v2.webp', detail: 'Zwei Nachbarn sprechen im Hausflur neben einem Aushang. Im Hintergrund sind Briefkästen und eine Treppe.' },
  { src: '/Bilder/exam-preparation/sitov-learning-photo-v2.webp', detail: 'Zwei Männer lernen gemeinsam an einem Tisch mit Unterlagen und einem Laptop.' },
  { src: '/Bilder/exam-simulation/sitov-museum-photo-v2.webp', detail: 'Zwei Besucher besprechen eine abstrakte Skulptur in einem Museum. Einer hält ein Ausstellungsblatt.' },
] as const

export function sitovSceneImage(topic: string, index: number): { src: string; alt: string } {
  const scene = sitovScenes[((index % sitovScenes.length) + sitovScenes.length) % sitovScenes.length]
  return { src: scene.src, alt: `Zwei Männer in einer Alltagssituation zum Thema ${topic}. ${scene.detail}` }
}
