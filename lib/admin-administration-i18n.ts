import { toUiLocale } from './locale-routing'

/** Seitentitel im Bereich „Verwaltung“, die über die Zertifikats-Texte hinausgehen (Phase 11.2). */
const de = {
  certificatesTitle: 'Zertifikate',
  certificatesIntro: 'Teilnahmebescheinigungen: Zuordnungen klären, tatsächliche Teilnahme bestätigen und Bescheinigungen verwalten.',
  importsTitle: 'CSV-Importe',
  importsIntro: 'Papierkram-Exporte (Kunden, Dienstleistungen, Rechnungen) hochladen, in der Vorschau prüfen und übernehmen.',
  importsNext: 'Klärfälle, Teilnahme und Bescheinigungen bearbeitest du anschließend unter „Zertifikate“.',
  toCertificates: 'Zu den Zertifikaten',
}
type Copy = typeof de
const en: Copy = {
  certificatesTitle: 'Certificates',
  certificatesIntro: 'Attendance certificates: resolve mappings, confirm actual attendance and manage certificates.',
  importsTitle: 'CSV imports',
  importsIntro: 'Upload Papierkram exports (customers, services, invoices), check the preview and apply them.',
  importsNext: 'Afterwards, handle open cases, attendance and certificates under “Certificates”.',
  toCertificates: 'Go to certificates',
}
const ru: Copy = {
  certificatesTitle: 'Сертификаты',
  certificatesIntro: 'Справки об участии: сопоставить данные, подтвердить фактическое участие и управлять справками.',
  importsTitle: 'Импорт CSV',
  importsIntro: 'Загрузить выгрузки Papierkram (клиенты, услуги, счета), проверить предпросмотр и применить.',
  importsNext: 'Спорные случаи, участие и справки затем обрабатываются в разделе «Сертификаты».',
  toCertificates: 'К сертификатам',
}
const uk: Copy = {
  certificatesTitle: 'Сертифікати',
  certificatesIntro: 'Довідки про участь: зіставити дані, підтвердити фактичну участь і керувати довідками.',
  importsTitle: 'Імпорт CSV',
  importsIntro: 'Завантажити вивантаження Papierkram (клієнти, послуги, рахунки), перевірити попередній перегляд і застосувати.',
  importsNext: 'Спірні випадки, участь і довідки потім опрацьовуються в розділі «Сертифікати».',
  toCertificates: 'До сертифікатів',
}
const tr: Copy = {
  certificatesTitle: 'Sertifikalar',
  certificatesIntro: 'Katılım belgeleri: eşleştirmeleri netleştirin, gerçek katılımı onaylayın ve belgeleri yönetin.',
  importsTitle: 'CSV içe aktarma',
  importsIntro: 'Papierkram dışa aktarımlarını (müşteriler, hizmetler, faturalar) yükleyin, önizlemeyi kontrol edin ve uygulayın.',
  importsNext: 'Açık durumlar, katılım ve belgeler ardından “Sertifikalar” bölümünde işlenir.',
  toCertificates: 'Sertifikalara git',
}

export function administrationCopy(lang: string): Copy {
  return { de, en, ru, uk, tr }[toUiLocale(lang)]
}
