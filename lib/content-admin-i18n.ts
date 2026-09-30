import { toUiLocale } from './locale-routing'

/** Texte der eigenständigen Lerninhalts-Bereiche im Lehrer-Dashboard (Phase 11.2). */
const de = {
  hubIntro: 'Vier eigenständige Bereiche – entsprechend den Lernmodi der Schüler.',
  vocabularyIntro: 'Wörter, Übersetzungen und Beispielsätze je Niveau und Lektion pflegen.',
  pathIntro: 'Aufgaben und Übungen des Lernpfads je Niveau und Lektion erstellen und pflegen.',
  mediaIntro: 'Videos, Präsentationen und Links in Ordnern je Niveau bereitstellen.',
  pronunciationIntro: 'Lesetexte für die Ausspracheaufnahmen der Schüler je Niveau und Lektion.',
  gapHint: 'Lücken-Hinweis (z. B. „morgen / arbeiten / müssen“)',
}
type Copy = typeof de
const en: Copy = {
  hubIntro: 'Four independent areas – matching the students’ learning modes.',
  vocabularyIntro: 'Maintain words, translations and example sentences per level and lesson.',
  pathIntro: 'Create and maintain the tasks and exercises of the learning path per level and lesson.',
  mediaIntro: 'Provide videos, presentations and links in folders per level.',
  pronunciationIntro: 'Reading texts for the students’ pronunciation recordings per level and lesson.',
  gapHint: 'Gap hint (e.g. “tomorrow / work / must”)',
}
const ru: Copy = {
  hubIntro: 'Четыре самостоятельных раздела – по учебным режимам учеников.',
  vocabularyIntro: 'Слова, переводы и примеры предложений по уровням и урокам.',
  pathIntro: 'Создавайте и редактируйте задания и упражнения учебного пути по уровням и урокам.',
  mediaIntro: 'Видео, презентации и ссылки в папках по уровням.',
  pronunciationIntro: 'Тексты для чтения, по которым ученики записывают произношение, по уровням и урокам.',
  gapHint: 'Подсказка к пропуску (например, «morgen / arbeiten / müssen»)',
}
const uk: Copy = {
  hubIntro: 'Чотири самостійні розділи – відповідно до навчальних режимів учнів.',
  vocabularyIntro: 'Слова, переклади та приклади речень за рівнями й уроками.',
  pathIntro: 'Створюйте й редагуйте завдання та вправи навчального шляху за рівнями й уроками.',
  mediaIntro: 'Відео, презентації та посилання в папках за рівнями.',
  pronunciationIntro: 'Тексти для читання, за якими учні записують вимову, за рівнями й уроками.',
  gapHint: 'Підказка до пропуску (наприклад, «morgen / arbeiten / müssen»)',
}
const tr: Copy = {
  hubIntro: 'Öğrencilerin öğrenme modlarına karşılık gelen dört bağımsız bölüm.',
  vocabularyIntro: 'Kelimeleri, çevirileri ve örnek cümleleri seviye ve derse göre yönetin.',
  pathIntro: 'Öğrenme yolunun görev ve alıştırmalarını seviye ve derse göre oluşturun ve yönetin.',
  mediaIntro: 'Videoları, sunumları ve bağlantıları seviyeye göre klasörlerde sunun.',
  pronunciationIntro: 'Öğrencilerin telaffuz kayıtları için okuma metinleri, seviye ve derse göre.',
  gapHint: 'Boşluk ipucu (ör. “morgen / arbeiten / müssen”)',
}

export function contentAdminCopy(lang: string): Copy {
  return { de, en, ru, uk, tr }[toUiLocale(lang)]
}
