/**
 * Authoring helpers for the learning path sources (see scripts/lib/path-seed-builder.mjs).
 * Translations are always written in the order [en, ru, uk, tr].
 */

/**
 * Remembers where a task was written (file and line of its mc()/gap()/sb() call), so that the
 * build can point to the exact source line of a rule violation. Not part of the seed.
 */
function located(task) {
  const frame = (new Error().stack ?? '').split('\n').slice(1)
    .map(line => line.match(/(file:\/\/[^\s)]+):(\d+):\d+\)?$/)).find(match => match && match[1] !== import.meta.url)
  return Object.defineProperty(task, 'origin', { value: frame ? { file: frame[1], line: Number(frame[2]) } : null, enumerable: false })
}

/** Multiple choice. `options[0]` is the solution; the build shuffles the order. */
export const mc = (goal, target, instr, question, options, tr, extra = {}) => located({ type: 'mc', goal, target, instr, question, options, tr, ...extra })

/**
 * Gap. `answer`: string or [solution, ...also accepted]. `distractors`: two wrong forms.
 * `tr`: the whole sentence in [en, ru, uk, tr]. `hint`: the German base form of the searched
 * word (string) – or its meaning in [en, ru, uk, tr] where the base form would be the answer.
 */
export const gap = (goal, target, instr, before, after, answer, distractors, tr, hint, extra = {}) =>
  located({ type: 'gap', goal, target, instr, before, after, answers: [answer].flat(), distractors, tr, gapHint: hint, ...extra })

/**
 * Turns a gap into a choice between the same forms: "Sie wohnt seit … Monat in Leipzig."
 * Useful where recognising the form is the aim. Typed gaps are safe as well: grading never
 * forgives a stored wrong form as a typing error (migration 58).
 */
export const asChoice = ({ goal, target, before, after, answers, distractors, tr, c, h }) =>
  mc(goal, target, I.choose, `${before}…${after}`, [answers[0], ...distractors], tr, { ...(c ? { c } : {}), ...(h ? { h } : {}) })

/** Word order. `sentence`: the solution, parts separated by " / ". `extra.alt`: other correct orders. */
export const sb = (goal, target, instr, sentence, tr, extra = {}) => located({ type: 'sb', goal, target, instr, sentence, tr, ...extra })

const i = (de, ...t) => ({ de, t })

/** Work instructions, the same wording as in A1.1 wherever the task type already existed. */
export const I = {
  choose: i('Wähle die richtige Antwort.', 'Choose the correct answer.', 'Выберите правильный ответ.', 'Виберіть правильну відповідь.', 'Doğru cevabı seçin.'),
  react: i('Was passt? Wähle die passende Reaktion.', 'What fits? Choose the right response.', 'Что подходит? Выберите подходящую реакцию.', 'Що підходить? Виберіть доречну реакцію.', 'Hangisi uygun? Doğru tepkiyi seçin.'),
  situation: i('Was sagst du in dieser Situation?', 'What do you say in this situation?', 'Что вы скажете в этой ситуации?', 'Що ви скажете в цій ситуації?', 'Bu durumda ne dersiniz?'),
  read: i('Lies den Text und wähle die richtige Antwort.', 'Read the text and choose the correct answer.', 'Прочитайте текст и выберите правильный ответ.', 'Прочитайте текст і виберіть правильну відповідь.', 'Metni okuyun ve doğru cevabı seçin.'),
  odd: i('Welches Wort passt nicht in die Gruppe?', 'Which word does not belong to the group?', 'Какое слово лишнее в этой группе?', 'Яке слово зайве в цій групі?', 'Hangi kelime bu gruba uymuyor?'),
  sentence: i('Welcher Satz ist richtig?', 'Which sentence is correct?', 'Какое предложение правильное?', 'Яке речення правильне?', 'Hangi cümle doğru?'),
  natural: i('Welcher Satz klingt am natürlichsten?', 'Which sentence sounds most natural?', 'Какое предложение звучит наиболее естественно?', 'Яке речення звучить найприродніше?', 'Hangi cümle en doğal duruyor?'),
  matchQuestion: i('Welche Frage passt zur Antwort?', 'Which question fits the answer?', 'Какой вопрос подходит к ответу?', 'Яке запитання підходить до відповіді?', 'Cevaba hangi soru uyuyor?'),
  sign: i('Was bedeutet das Schild? Wähle die richtige Antwort.', 'What does the sign mean? Choose the correct answer.', 'Что означает эта табличка? Выберите правильный ответ.', 'Що означає ця табличка? Виберіть правильну відповідь.', 'Tabela ne anlama geliyor? Doğru cevabı seçin.'),

  verb: i('Ergänze die richtige Verbform.', 'Fill in the correct verb form.', 'Вставьте правильную форму глагола.', 'Вставте правильну форму дієслова.', 'Fiilin doğru biçimini yazın.'),
  word: i('Ergänze das passende Wort.', 'Fill in the missing word.', 'Вставьте подходящее слово.', 'Вставте відповідне слово.', 'Uygun kelimeyi yazın.'),
  article: i('Ergänze den passenden Artikel.', 'Fill in the correct article.', 'Вставьте подходящий артикль.', 'Вставте відповідний артикль.', 'Uygun artikeli yazın.'),
  modal: i('Ergänze das Modalverb in der richtigen Form.', 'Fill in the modal verb in the correct form.', 'Вставьте модальный глагол в правильной форме.', 'Вставте модальне дієслово в правильній формі.', 'Kip fiilini doğru biçimde yazın.'),
  prep: i('Ergänze die passende Präposition.', 'Fill in the correct preposition.', 'Вставьте подходящий предлог.', 'Вставте відповідний прийменник.', 'Uygun edatı yazın.'),
  pronoun: i('Ergänze das passende Pronomen.', 'Fill in the correct pronoun.', 'Вставьте подходящее местоимение.', 'Вставте відповідний займенник.', 'Uygun zamiri yazın.'),
  possessive: i('Ergänze den passenden Possessivartikel.', 'Fill in the correct possessive (my, your …).', 'Вставьте притяжательное слово (мой, твой, Ваш).', 'Вставте присвійне слово (мій, твій, Ваш).', 'Uygun iyelik sözcüğünü yazın (benim, senin, sizin).'),
  qword: i('Ergänze das passende Fragewort.', 'Fill in the correct question word.', 'Вставьте подходящее вопросительное слово.', 'Вставте відповідне питальне слово.', 'Uygun soru kelimesini yazın.'),
  expression: i('Ergänze den passenden Ausdruck.', 'Fill in the right expression.', 'Вставьте подходящее выражение.', 'Вставте відповідний вислів.', 'Uygun ifadeyi yazın.'),
  form: i('Ergänze die richtige Form.', 'Fill in the correct form.', 'Вставьте правильную форму.', 'Вставте правильну форму.', 'Doğru biçimi yazın.'),
  feminine: i('Ergänze die weibliche Berufsbezeichnung.', 'Fill in the female job title.', 'Вставьте название профессии в женском роде.', 'Вставте назву професії в жіночому роді.', 'Meslek adının kadın biçimini yazın.'),
  preterite: i('Ergänze sein oder haben im Präteritum.', 'Fill in sein or haben in the past tense (Präteritum).', 'Вставьте sein или haben в прошедшем времени (Präteritum).', 'Вставте sein або haben у минулому часі (Präteritum).', 'Sein ya da haben fiilini geçmiş zamanda (Präteritum) yazın.'),
  imperative: i('Ergänze den Imperativ.', 'Fill in the imperative.', 'Вставьте глагол в повелительном наклонении.', 'Вставте дієслово в наказовому способі.', 'Emir kipini yazın.'),
  polite: i('Ergänze die höfliche Form.', 'Fill in the polite form.', 'Вставьте вежливую форму.', 'Вставте ввічливу форму.', 'Kibar biçimi yazın.'),
  comparison: i('Ergänze die richtige Vergleichsform.', 'Fill in the correct comparative form.', 'Вставьте правильную степень сравнения.', 'Вставте правильний ступінь порівняння.', 'Doğru karşılaştırma biçimini yazın.'),
  ordinal: i('Schreib das Datum als Wort.', 'Write the date as a word.', 'Напишите дату словом.', 'Напишіть дату словом.', 'Tarihi yazıyla yazın.'),
  participle: i('Ergänze das Partizip.', 'Fill in the past participle.', 'Вставьте причастие (Partizip II).', 'Вставте дієприкметник (Partizip II).', 'Partizip II biçimini yazın.'),
  auxiliary: i('Ergänze haben oder sein in der richtigen Form.', 'Fill in haben or sein in the correct form.', 'Вставьте haben или sein в правильной форме.', 'Вставте haben або sein у правильній формі.', 'Haben ya da sein fiilini doğru biçimde yazın.'),
  reflexive: i('Ergänze das Reflexivpronomen.', 'Fill in the reflexive pronoun.', 'Вставьте возвратное местоимение.', 'Вставте зворотний займенник.', 'Dönüşlü zamiri yazın.'),
  modalPast: i('Ergänze das Modalverb im Präteritum.', 'Fill in the modal verb in the past tense (Präteritum).', 'Вставьте модальный глагол в прошедшем времени (Präteritum).', 'Вставте модальне дієслово в минулому часі (Präteritum).', 'Kip fiilini geçmiş zamanda (Präteritum) yazın.'),
  adverb: i('Ergänze das passende Adverb.', 'Fill in the correct adverb.', 'Вставьте подходящее наречие.', 'Вставте відповідний прислівник.', 'Uygun zarfı yazın.'),
  ending: i('Ergänze das Wort mit der richtigen Endung.', 'Fill in the word with the correct ending.', 'Вставьте слово с правильным окончанием.', 'Вставте слово з правильним закінченням.', 'Kelimeyi doğru ekle yazın.'),
  conjunction: i('Ergänze die passende Konjunktion.', 'Fill in the correct conjunction.', 'Вставьте подходящий союз.', 'Вставте відповідний сполучник.', 'Uygun bağlacı yazın.'),

  order: i('Bring die Wörter in die richtige Reihenfolge.', 'Put the words in the correct order.', 'Расставьте слова в правильном порядке.', 'Розставте слова в правильному порядку.', 'Kelimeleri doğru sıraya koyun.'),
  question: i('Bilde eine Frage aus den Wörtern.', 'Make a question from the words.', 'Составьте вопрос из этих слов.', 'Складіть запитання з цих слів.', 'Bu kelimelerle bir soru oluşturun.'),
  request: i('Bilde eine Aufforderung aus den Wörtern.', 'Make a request from the words.', 'Составьте просьбу из этих слов.', 'Складіть прохання з цих слів.', 'Bu kelimelerle bir rica cümlesi oluşturun.'),
}
