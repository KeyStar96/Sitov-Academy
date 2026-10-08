import { toUiLocale } from '@/lib/locale-routing'

const COPY = {
  de: { title: 'Übersetzungssprache festlegen', message: 'Für diese Vokabelübungen fehlt eine unterstützte Übersetzungssprache. Prüfe die Muttersprache im Profil: Englisch, Russisch, Ukrainisch oder Türkisch. Die Oberfläche kann Deutsch bleiben.', action: 'Sprachangaben prüfen', locked: 'Eine unterstützte Übersetzungssprache fehlt.' },
  en: { title: 'Choose a translation language', message: 'These vocabulary exercises need a supported translation language. Check your native language in your profile: English, Russian, Ukrainian or Turkish. Your interface can stay in German.', action: 'Check language settings', locked: 'A supported translation language is missing.' },
  ru: { title: 'Выберите язык перевода', message: 'Для этих упражнений нужен поддерживаемый язык перевода. Проверьте родной язык в профиле: английский, русский, украинский или турецкий. Интерфейс может оставаться немецким.', action: 'Проверить языковые настройки', locked: 'Не указан поддерживаемый язык перевода.' },
  uk: { title: 'Виберіть мову перекладу', message: 'Для цих вправ потрібна підтримувана мова перекладу. Перевірте рідну мову в профілі: англійська, російська, українська або турецька. Інтерфейс може залишатися німецьким.', action: 'Перевірити мовні налаштування', locked: 'Не вказано підтримувану мову перекладу.' },
  tr: { title: 'Çeviri dilini seçin', message: 'Bu kelime alıştırmaları desteklenen bir çeviri dili gerektirir. Profilinizdeki ana dili kontrol edin: İngilizce, Rusça, Ukraynaca veya Türkçe. Arayüzünüz Almanca kalabilir.', action: 'Dil ayarlarını kontrol edin', locked: 'Desteklenen bir çeviri dili eksik.' },
} as const

export function getTrainerLanguageCopy(lang: string) { return COPY[toUiLocale(lang)] }
