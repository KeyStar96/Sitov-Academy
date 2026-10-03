const authorHints: Record<string, string> = {
  de: 'Die Audioaufnahme fehlt und wurde zur Vorbereitung vorgemerkt. Bitte Audio auf dem Mac vorbereiten und hochladen, danach erneut veröffentlichen. Deine Eingaben bleiben erhalten.',
  en: 'The audio is missing and has been queued for preparation. Prepare and upload the audio on the Mac, then publish again. Your entries are retained.',
  ru: 'Аудиозапись отсутствует и добавлена в очередь подготовки. Подготовьте и загрузите аудио на Mac, затем опубликуйте снова. Введённые данные сохранены.',
  uk: 'Аудіозапис відсутній і доданий до черги підготовки. Підготуйте та завантажте аудіо на Mac, потім опублікуйте знову. Введені дані збережено.',
  tr: 'Ses kaydı eksik ve hazırlanmak üzere sıraya alındı. Sesi Mac üzerinde hazırlayıp yükledikten sonra yeniden yayınlayın. Girdileriniz korunuyor.',
}

export function preparedAudioAuthorHint(language: string): string {
  return authorHints[language] ?? authorHints.de
}
