import { toUiLocale } from './locale-routing'

/** Zusätzliche Texte der Schüleransichten im Lehrer-Dashboard (Phase 11.2). */
const de = {
  filtersAndSort: 'Filter & Sortierung',
  levels: 'Niveaus',
  noLevel: 'Kein Niveau',
  noLevelAction: 'Jetzt zuordnen',
  contact: 'Kontakt',
  email: 'E-Mail',
  phone: 'Telefon',
  address: 'Adresse',
  backToList: 'Alle Schüler',
  sections: 'Bereiche des Schülerprofils',
  correctionsIntro: 'Ausspracheaufnahmen der Schüler anhören und mit Text oder Sprachnachricht beantworten.',
  analyticsFilter: 'Auswahl',
}
type Copy = typeof de
const en: Copy = {
  filtersAndSort: 'Filters & sorting',
  levels: 'Levels',
  noLevel: 'No level',
  noLevelAction: 'Assign now',
  contact: 'Contact',
  email: 'E-mail',
  phone: 'Phone',
  address: 'Address',
  backToList: 'All students',
  sections: 'Student profile sections',
  correctionsIntro: 'Listen to students’ pronunciation recordings and reply with text or a voice message.',
  analyticsFilter: 'Selection',
}
const ru: Copy = {
  filtersAndSort: 'Фильтры и сортировка',
  levels: 'Уровни',
  noLevel: 'Нет уровня',
  noLevelAction: 'Назначить',
  contact: 'Контакты',
  email: 'E-mail',
  phone: 'Телефон',
  address: 'Адрес',
  backToList: 'Все ученики',
  sections: 'Разделы профиля ученика',
  correctionsIntro: 'Прослушивайте записи произношения учеников и отвечайте текстом или голосовым сообщением.',
  analyticsFilter: 'Выбор',
}
const uk: Copy = {
  filtersAndSort: 'Фільтри та сортування',
  levels: 'Рівні',
  noLevel: 'Немає рівня',
  noLevelAction: 'Призначити',
  contact: 'Контакти',
  email: 'E-mail',
  phone: 'Телефон',
  address: 'Адреса',
  backToList: 'Усі учні',
  sections: 'Розділи профілю учня',
  correctionsIntro: 'Прослуховуйте записи вимови учнів і відповідайте текстом або голосовим повідомленням.',
  analyticsFilter: 'Вибір',
}
const tr: Copy = {
  filtersAndSort: 'Filtreler ve sıralama',
  levels: 'Seviyeler',
  noLevel: 'Seviye yok',
  noLevelAction: 'Şimdi ata',
  contact: 'İletişim',
  email: 'E-posta',
  phone: 'Telefon',
  address: 'Adres',
  backToList: 'Tüm öğrenciler',
  sections: 'Öğrenci profili bölümleri',
  correctionsIntro: 'Öğrencilerin telaffuz kayıtlarını dinleyin ve metin veya sesli mesajla yanıtlayın.',
  analyticsFilter: 'Seçim',
}

export function studentsAdminCopy(lang: string): Copy {
  return { de, en, ru, uk, tr }[toUiLocale(lang)]
}
