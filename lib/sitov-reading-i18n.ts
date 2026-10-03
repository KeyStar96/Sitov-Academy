const sitovDe = {
  lookup: 'Bedeutung von „{word}“ anzeigen', hint: 'Tippe ein Wort an: Die Wiedergabe pausiert und du siehst seine Bedeutung.',
  loading: 'Bedeutung wird geladen …', missing: 'Für dieses Wort ist noch keine Übersetzung hinterlegt.',
  failed: 'Die Bedeutung konnte gerade nicht geladen werden.', retry: 'Erneut versuchen', close: 'Wortblase schließen',
  resume: 'Weiterhören', restart: 'Von vorn', restartAria: 'Den Text von Anfang an anhören',
}
type SitovReadingCopy = typeof sitovDe
const sitovCopy: Record<string, SitovReadingCopy> = {
  de: sitovDe,
  en: { lookup: 'Show the meaning of “{word}”', hint: 'Tap a word: playback pauses and its meaning appears.', loading: 'Loading meaning …', missing: 'No translation has been added for this word yet.', failed: 'The meaning could not be loaded just now.', retry: 'Try again', close: 'Close word bubble', resume: 'Continue listening', restart: 'From the start', restartAria: 'Listen to the text from the beginning' },
  ru: { lookup: 'Показать значение «{word}»', hint: 'Нажми на слово: аудио приостановится и появится значение.', loading: 'Загрузка значения …', missing: 'Для этого слова пока нет перевода.', failed: 'Сейчас не удалось загрузить значение.', retry: 'Повторить', close: 'Закрыть подсказку', resume: 'Продолжить слушать', restart: 'С начала', restartAria: 'Послушать текст с начала' },
  uk: { lookup: 'Показати значення «{word}»', hint: 'Натисни на слово: аудіо призупиниться і з’явиться значення.', loading: 'Завантаження значення …', missing: 'Для цього слова ще немає перекладу.', failed: 'Зараз не вдалося завантажити значення.', retry: 'Спробувати ще', close: 'Закрити підказку', resume: 'Продовжити слухати', restart: 'Від початку', restartAria: 'Послухати текст від початку' },
  tr: { lookup: '“{word}” kelimesinin anlamını göster', hint: 'Bir kelimeye dokun: ses duraklar ve anlamı görünür.', loading: 'Anlam yükleniyor …', missing: 'Bu kelime için henüz çeviri eklenmedi.', failed: 'Anlam şu anda yüklenemedi.', retry: 'Tekrar dene', close: 'Kelime balonunu kapat', resume: 'Dinlemeye devam et', restart: 'Baştan', restartAria: 'Metni baştan dinle' },
}
export function sitovReadingCopy(locale: string): SitovReadingCopy { return sitovCopy[locale] ?? sitovDe }
