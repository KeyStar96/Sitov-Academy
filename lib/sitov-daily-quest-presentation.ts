import type { DailyQuest, DailyQuestStep } from '@/lib/daily-quest-contract'
import { toUiLocale } from '@/lib/locale-routing'

// Only general UI copy belongs in the client. Authored grading explanations
// live in the server-only localization module and are released after grading.
const sitovCopy = {
  de: {
    discover: 'Entdecke die Wörter für diese Situation. Tippe jedes Wort an und höre zu.',
    build: 'Setze den Satz aus den Wortgruppen zusammen.', dialogue: 'Lies die Szene und wähle eine passende Antwort.',
    goal: 'Übe Deutsch in einer Alltagssituation.', you: 'Du', completionTitle: 'Deutsch im Alltag geschafft!',
    completionText: 'Du hast Wörter entdeckt, einen Satz gebaut und passend geantwortet.',
    discoverCorrect: 'Gut! Du hast alle Wörter entdeckt.', discoverWrong: 'Tippe zuerst jedes Wort an.',
    buildCorrect: 'Der Satz passt.', buildWrong: 'Prüfe die Reihenfolge. Achte auf die Position des Verbs.',
    dialogueCorrect: 'Deine Antwort passt zur Situation.', dialogueWrong: 'Lies die Frage und die Szene noch einmal und wähle eine passende Antwort.',
    focus: 'Achte auf:',
  },
  en: {
    discover: 'Explore the words for this situation. Tap each word and listen.',
    build: 'Put the word groups together to form the sentence.', dialogue: 'Read the scene and choose a suitable reply.',
    goal: 'Practise German in an everyday situation.', you: 'You', completionTitle: 'Everyday German completed!',
    completionText: 'You explored words, built a sentence and chose a suitable reply.',
    discoverCorrect: 'Good! You explored every word.', discoverWrong: 'Tap every word first.',
    buildCorrect: 'The sentence fits.', buildWrong: 'Check the order. Pay attention to the position of the verb.',
    dialogueCorrect: 'Your reply fits the situation.', dialogueWrong: 'Read the question and the scene again and choose a suitable reply.',
    focus: 'Pay attention to:',
  },
  ru: {
    discover: 'Изучи слова для этой ситуации. Нажми на каждое слово и послушай.',
    build: 'Составь предложение из групп слов.', dialogue: 'Прочитай сцену и выбери подходящий ответ.',
    goal: 'Практикуй немецкий в повседневной ситуации.', you: 'Ты', completionTitle: 'Немецкий в повседневной жизни — готово!',
    completionText: 'Ты изучил слова, составил предложение и выбрал подходящий ответ.',
    discoverCorrect: 'Хорошо! Ты изучил все слова.', discoverWrong: 'Сначала нажми на каждое слово.',
    buildCorrect: 'Предложение подходит.', buildWrong: 'Проверь порядок слов. Обрати внимание на место глагола.',
    dialogueCorrect: 'Твой ответ подходит к ситуации.', dialogueWrong: 'Ещё раз прочитай вопрос и сцену и выбери подходящий ответ.',
    focus: 'Обрати внимание на:',
  },
  uk: {
    discover: 'Вивчи слова для цієї ситуації. Натисни на кожне слово й послухай.',
    build: 'Склади речення з груп слів.', dialogue: 'Прочитай сцену й вибери доречну відповідь.',
    goal: 'Практикуй німецьку в повсякденній ситуації.', you: 'Ти', completionTitle: 'Німецька в повсякденному житті — готово!',
    completionText: 'Ти вивчив слова, склав речення й вибрав доречну відповідь.',
    discoverCorrect: 'Добре! Ти вивчив усі слова.', discoverWrong: 'Спочатку натисни на кожне слово.',
    buildCorrect: 'Речення підходить.', buildWrong: 'Перевір порядок слів. Зверни увагу на місце дієслова.',
    dialogueCorrect: 'Твоя відповідь доречна в цій ситуації.', dialogueWrong: 'Ще раз прочитай запитання й сцену та вибери доречну відповідь.',
    focus: 'Зверни увагу на:',
  },
  tr: {
    discover: 'Bu durum için kelimeleri keşfet. Her kelimeye dokun ve dinle.',
    build: 'Kelime gruplarını birleştirerek cümleyi kur.', dialogue: 'Sahneyi oku ve uygun bir cevap seç.',
    goal: 'Günlük bir durumda Almanca pratiği yap.', you: 'Sen', completionTitle: 'Günlük Almanca tamamlandı!',
    completionText: 'Kelimeleri keşfettin, bir cümle kurdun ve uygun bir cevap seçtin.',
    discoverCorrect: 'Güzel! Tüm kelimeleri keşfettin.', discoverWrong: 'Önce her kelimeye dokun.',
    buildCorrect: 'Cümle uygun.', buildWrong: 'Sıralamayı kontrol et. Fiilin yerine dikkat et.',
    dialogueCorrect: 'Cevabın duruma uygun.', dialogueWrong: 'Soruyu ve sahneyi tekrar oku ve uygun bir cevap seç.',
    focus: 'Şuna dikkat et:',
  },
}

export function getSitovDailyQuestPresentationCopy(locale: string) { return sitovCopy[toUiLocale(locale)] }

export function getSitovDailyQuestFeedbackFallback(kind: DailyQuestStep['kind'], correct: boolean, locale: string) {
  const copy = getSitovDailyQuestPresentationCopy(locale)
  return kind === 'discover' ? correct ? copy.discoverCorrect : copy.discoverWrong
    : kind === 'sentence_build' ? correct ? copy.buildCorrect : copy.buildWrong
      : correct ? copy.dialogueCorrect : copy.dialogueWrong
}

export function isSitovDailyQuestDirection(prompt: string) {
  return /^(Entdecke|Antworte|Formuliere|Setze|Wähle|Welche Antwort passt|Was antwortest du|Was sagst du|Wie reagierst du)/u.test(prompt)
}

/** Compatibility for local previews or old payloads: never show German directions in a foreign UI. */
export function getSitovDailyQuestPresentation(quest: DailyQuest, locale: string): DailyQuest {
  const sitovLocale = toUiLocale(locale)
  if (sitovLocale === 'de' || quest.sitovUiLocale === sitovLocale) return quest
  const copy = getSitovDailyQuestPresentationCopy(sitovLocale)
  return { ...quest, sitovUiLocale: sitovLocale, subtitle: copy.goal,
    completion: { title: copy.completionTitle, text: copy.completionText },
    scene: { ...quest.scene, characters: quest.scene.characters.map(character => character.name === 'Du' ? { ...character, name: copy.you } : character) },
    steps: quest.steps.map(step => step.kind === 'discover' ? { ...step, instruction: copy.discover }
      : step.kind === 'sentence_build' ? { ...step, prompt: copy.build }
        : { ...step, sitovInstruction: copy.dialogue, prompt: isSitovDailyQuestDirection(step.prompt) ? copy.dialogue : step.prompt, sitovPromptLocale: isSitovDailyQuestDirection(step.prompt) ? sitovLocale : 'de' }),
  }
}
