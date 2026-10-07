import { toUiLocale } from './locale-routing'

/** Texte der eigenständigen Lerninhalts-Bereiche im Lehrer-Dashboard (Phase 11.2). */
const de = {
  hubIntro: 'Vokabeln, Medien und Aussprachetexte für die Schüler pflegen.',
  vocabularyIntro: 'Wörter, Übersetzungen und Beispielsätze je Niveau und Lektion pflegen.',
  mediaIntro: 'Videos, Präsentationen und Links in Ordnern je Niveau bereitstellen.',
  pronunciationIntro: 'Lesetexte für die Ausspracheaufnahmen der Schüler je Niveau und Lektion.',
}
type Copy = typeof de
const en: Copy = {
  hubIntro: 'Maintain vocabulary, media and pronunciation texts for students.',
  vocabularyIntro: 'Maintain words, translations and example sentences per level and lesson.',
  mediaIntro: 'Provide videos, presentations and links in folders per level.',
  pronunciationIntro: 'Reading texts for the students’ pronunciation recordings per level and lesson.',
}
const ru: Copy = {
  hubIntro: 'Редактируйте лексику, материалы и тексты для произношения учеников.',
  vocabularyIntro: 'Слова, переводы и примеры предложений по уровням и урокам.',
  mediaIntro: 'Видео, презентации и ссылки в папках по уровням.',
  pronunciationIntro: 'Тексты для чтения, по которым ученики записывают произношение, по уровням и урокам.',
}
const uk: Copy = {
  hubIntro: 'Редагуйте лексику, матеріали й тексти для вимови учнів.',
  vocabularyIntro: 'Слова, переклади та приклади речень за рівнями й уроками.',
  mediaIntro: 'Відео, презентації та посилання в папках за рівнями.',
  pronunciationIntro: 'Тексти для читання, за якими учні записують вимову, за рівнями й уроками.',
}
const tr: Copy = {
  hubIntro: 'Öğrenciler için kelimeleri, materyalleri ve telaffuz metinlerini yönetin.',
  vocabularyIntro: 'Kelimeleri, çevirileri ve örnek cümleleri seviye ve derse göre yönetin.',
  mediaIntro: 'Videoları, sunumları ve bağlantıları seviyeye göre klasörlerde sunun.',
  pronunciationIntro: 'Öğrencilerin telaffuz kayıtları için okuma metinleri, seviye ve derse göre.',
}

export function contentAdminCopy(lang: string): Copy {
  return { de, en, ru, uk, tr }[toUiLocale(lang)]
}
