import { toUiLocale } from '@/lib/locale-routing'

const COPY = {
  de: {
    title: 'Wähle deine Lernsprache',
    message: 'Vokabeln, Lernpfad und Aussprache vergleichen Deutsch mit deiner Oberflächensprache. Wähle Englisch, Russisch, Ukrainisch oder Türkisch im Profil, um diese Bereiche zu öffnen. Verbtrainer und Mediathek kannst du auch auf Deutsch nutzen.',
    action: 'Sprache im Profil auswählen',
    locked: 'Wähle zuerst eine andere Oberflächensprache als Deutsch.',
  },
  en: {
    title: 'Choose your learning language',
    message: 'Vocabulary, the learning path and pronunciation compare German with your interface language. Choose English, Russian, Ukrainian or Turkish in your profile to open these areas. The verb trainer and media library are also available in German.',
    action: 'Choose a language in your profile',
    locked: 'First choose an interface language other than German.',
  },
  ru: {
    title: 'Выберите язык обучения',
    message: 'Слова, учебный путь и произношение сравнивают немецкий с языком интерфейса. Выберите английский, русский, украинский или турецкий в профиле, чтобы открыть эти разделы. Тренажёр глаголов и медиатека доступны и на немецком.',
    action: 'Выбрать язык в профиле',
    locked: 'Сначала выберите язык интерфейса, отличный от немецкого.',
  },
  uk: {
    title: 'Виберіть мову навчання',
    message: 'Слова, навчальний шлях і вимова порівнюють німецьку з мовою інтерфейсу. Виберіть англійську, російську, українську або турецьку в профілі, щоб відкрити ці розділи. Тренажер дієслів і медіатека доступні й німецькою.',
    action: 'Вибрати мову у профілі',
    locked: 'Спочатку виберіть мову інтерфейсу, відмінну від німецької.',
  },
  tr: {
    title: 'Öğrenme dilinizi seçin',
    message: 'Kelimeler, öğrenme yolu ve telaffuz Almancayı arayüz dilinizle karşılaştırır. Bu alanları açmak için profilinizde İngilizce, Rusça, Ukraynaca veya Türkçe seçin. Fiil alıştırması ve medya kütüphanesi Almanca arayüzde de kullanılabilir.',
    action: 'Profilde dil seçin',
    locked: 'Önce Almanca dışında bir arayüz dili seçin.',
  },
} as const

export function getTrainerLanguageCopy(lang: string) { return COPY[toUiLocale(lang)] }
