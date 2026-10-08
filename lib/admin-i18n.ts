import germanDictionary from '@/dictionaries/de.json'
import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

export const ADMIN_FALLBACKS = germanDictionary.admin

export type AdminTranslationKey = Extract<keyof typeof ADMIN_FALLBACKS, string>

export type AdminTranslations = Translations

export type AdminTranslator = Translator<AdminTranslationKey>

export function createAdminTranslator(translations: AdminTranslations): AdminTranslator {
  return createTranslator(ADMIN_FALLBACKS, translations)
}

/** Commercial editor copy follows the route interface locale. */
export const sitovCommercialAdminCopy = {
  de: { title: 'Plattformzugang', vip: 'VIP-Zugang', grant: 'VIP freigeben', revoke: 'VIP widerrufen', trial: 'Testzugang', all: 'Alle – auch künftig', none: 'Keine', selected: 'Auswahl', units: 'Einheiten', items: 'Aufgaben', allItems: 'Alle Aufgaben – auch künftig', save: 'Testzugang speichern', saved: 'Gespeichert', loading: 'Wird geladen …', error: 'Zugriff konnte nicht geladen oder gespeichert werden.', stale: 'Die Freigabe wurde inzwischen geändert. Bitte neu laden.', retry: 'Neu laden', empty: 'Keine veröffentlichten Inhalte vorhanden.', help: 'Hilfe', info: 'VIP und Testzugang ergänzen bestehende manuelle und gekaufte Rechte. Ein Widerruf entfernt nur diese Quelle. Aussprache-Vortests bleiben erforderlich. Testzugang ist kein Abo. „Alle“ umfasst künftig veröffentlichte Inhalte; eine leere Auswahl erlaubt keine Inhalte.', unavailable: 'Eine gespeicherte Auswahl fehlt im Katalog. Bitte prüfen, bevor du sie ersetzt.' },
  en: { title: 'Platform access', vip: 'VIP access', grant: 'Grant VIP', revoke: 'Revoke VIP', trial: 'Trial access', all: 'All – including future content', none: 'None', selected: 'Selection', units: 'Units', items: 'Tasks', allItems: 'All tasks – including future content', save: 'Save trial access', saved: 'Saved', loading: 'Loading …', error: 'Access could not be loaded or saved.', stale: 'Access has changed. Please reload.', retry: 'Reload', empty: 'No published content available.', help: 'Help', info: 'VIP and trial access supplement existing manual and purchased rights. Revoking removes only that source. Pronunciation pretests remain required. Trial access is not a subscription. “All” includes future published content; an empty selection allows no content.', unavailable: 'A saved selection is missing from the catalog. Review it before replacing it.' },
  ru: { title: 'Доступ к платформе', vip: 'VIP-доступ', grant: 'Предоставить VIP', revoke: 'Отозвать VIP', trial: 'Пробный доступ', all: 'Все, включая будущие', none: 'Ничего', selected: 'Выбор', units: 'Разделы', items: 'Задания', allItems: 'Все задания, включая будущие', save: 'Сохранить пробный доступ', saved: 'Сохранено', loading: 'Загрузка …', error: 'Не удалось загрузить или сохранить доступ.', stale: 'Доступ уже изменён. Обновите данные.', retry: 'Обновить', empty: 'Опубликованных материалов нет.', help: 'Помощь', info: 'VIP и пробный доступ дополняют ручные и купленные права. Отзыв удаляет только этот источник. Тесты произношения остаются обязательными. Пробный доступ не является подпиской. «Все» включает будущие опубликованные материалы; пустой выбор не даёт доступа.', unavailable: 'Сохранённый элемент отсутствует в каталоге. Проверьте выбор перед заменой.' },
  uk: { title: 'Доступ до платформи', vip: 'VIP-доступ', grant: 'Надати VIP', revoke: 'Відкликати VIP', trial: 'Пробний доступ', all: 'Усі, включно з майбутніми', none: 'Жодних', selected: 'Вибір', units: 'Розділи', items: 'Завдання', allItems: 'Усі завдання, включно з майбутніми', save: 'Зберегти пробний доступ', saved: 'Збережено', loading: 'Завантаження …', error: 'Не вдалося завантажити або зберегти доступ.', stale: 'Доступ уже змінено. Оновіть дані.', retry: 'Оновити', empty: 'Опублікованих матеріалів немає.', help: 'Допомога', info: 'VIP і пробний доступ доповнюють ручні та придбані права. Відкликання видаляє лише це джерело. Тести вимови залишаються обов’язковими. Пробний доступ не є підпискою. «Усі» охоплює майбутні опубліковані матеріали; порожній вибір не надає доступу.', unavailable: 'Збережений елемент відсутній у каталозі. Перевірте вибір перед заміною.' },
  tr: { title: 'Platform erişimi', vip: 'VIP erişimi', grant: 'VIP erişimi ver', revoke: 'VIP erişimini kaldır', trial: 'Deneme erişimi', all: 'Gelecektekiler dahil tümü', none: 'Hiçbiri', selected: 'Seçim', units: 'Üniteler', items: 'Görevler', allItems: 'Gelecektekiler dahil tüm görevler', save: 'Deneme erişimini kaydet', saved: 'Kaydedildi', loading: 'Yükleniyor …', error: 'Erişim yüklenemedi veya kaydedilemedi.', stale: 'Erişim değiştirilmiş. Yeniden yükleyin.', retry: 'Yeniden yükle', empty: 'Yayımlanmış içerik yok.', help: 'Yardım', info: 'VIP ve deneme erişimi mevcut manuel ve satın alınmış haklara eklenir. Kaldırma yalnızca bu kaynağı kaldırır. Telaffuz ön testleri zorunlu kalır. Deneme erişimi bir abonelik değildir. “Tümü” gelecekte yayımlanacak içeriği kapsar; boş seçim erişim vermez.', unavailable: 'Kayıtlı bir seçim katalogda yok. Değiştirmeden önce kontrol edin.' },
} as const
export function getSitovCommercialAdminCopy(locale: unknown) {
  return sitovCommercialAdminCopy[locale === 'en' || locale === 'ru' || locale === 'uk' || locale === 'tr' ? locale : 'de']
}

export function getSitovCommercialKindLabel(locale: unknown, kind: string): string {
  const kinds = ['vocabulary_card','exercise','reading_text','video','verb','path_node','path_task','presentation','path_special','path_special_item']
  const labels = locale === 'en' ? ['Word','Exercise','Pronunciation text','Video','Verb','Path section','Path task','Document','Special','Special task']
    : locale === 'ru' ? ['Слово','Упражнение','Текст произношения','Видео','Глагол','Раздел пути','Задание пути','Документ','Спецраздел','Спецзадание']
    : locale === 'uk' ? ['Слово','Вправа','Текст вимови','Відео','Дієслово','Розділ шляху','Завдання шляху','Документ','Спецрозділ','Спецзавдання']
    : locale === 'tr' ? ['Kelime','Alıştırma','Telaffuz metni','Video','Fiil','Yol bölümü','Yol görevi','Belge','Özel bölüm','Özel görev']
    : ['Wort','Übung','Aussprachetext','Video','Verb','Lernabschnitt','Lernaufgabe','Dokument','Special','Special-Aufgabe']
  return labels[kinds.indexOf(kind)] ?? kind
}
