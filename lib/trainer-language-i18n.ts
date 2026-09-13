import { toUiLocale } from '@/lib/locale-routing'

const COPY = {
  de: {
    title: 'Wähle deine Lernsprache',
    message: 'Die Trainer vergleichen Deutsch mit deiner ausgewählten Oberflächensprache. Wähle Englisch, Russisch, Ukrainisch oder Türkisch in deinem Profil, um mit dem Lernen zu beginnen.',
    action: 'Sprache im Profil auswählen',
    locked: 'Wähle zuerst eine andere Oberflächensprache als Deutsch.',
  },
  en: {
    title: 'Choose your learning language',
    message: 'The trainers compare German with your selected interface language. Choose English, Russian, Ukrainian or Turkish in your profile to start learning.',
    action: 'Choose a language in your profile',
    locked: 'First choose an interface language other than German.',
  },
  ru: {
    title: 'Выберите язык обучения',
    message: 'Тренажёры сравнивают немецкий с выбранным языком интерфейса. Выберите английский, русский, украинский или турецкий в профиле, чтобы начать обучение.',
    action: 'Выбрать язык в профиле',
    locked: 'Сначала выберите язык интерфейса, отличный от немецкого.',
  },
  uk: {
    title: 'Виберіть мову навчання',
    message: 'Тренажери порівнюють німецьку з вибраною мовою інтерфейсу. Виберіть англійську, російську, українську або турецьку у профілі, щоб почати навчання.',
    action: 'Вибрати мову у профілі',
    locked: 'Спочатку виберіть мову інтерфейсу, відмінну від німецької.',
  },
  tr: {
    title: 'Öğrenme dilinizi seçin',
    message: 'Alıştırmalar Almancayı seçtiğiniz arayüz diliyle karşılaştırır. Öğrenmeye başlamak için profilinizde İngilizce, Rusça, Ukraynaca veya Türkçe seçin.',
    action: 'Profilde dil seçin',
    locked: 'Önce Almanca dışında bir arayüz dili seçin.',
  },
} as const

export function getTrainerLanguageCopy(lang: string) { return COPY[toUiLocale(lang)] }
