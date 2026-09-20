import { toUiLocale } from './locale-routing'

const de = {
  title: 'Offene Kontozuordnungen', intro: 'Prüfe bei gemeinsam verwendeten E-Mail-Adressen persönlich, welche Anmeldung zu welchem Konto gehört.',
  empty: 'Keine offenen Kontozuordnungen.', account: 'Verifiziertes Konto', choose: 'Konto auswählen', assign: 'Zuordnung bestätigen',
  confirm: 'Ich habe persönlich geprüft, dass diese Anmeldung zu diesem Konto gehört.',
  blocked: 'Dieses Konto hat bereits eine Zuordnung oder Buchungen. Eine Zusammenführung ist hier nicht möglich.',
  bookings: 'Buchungen', saved: 'Die Anmeldung wurde dem Konto zugeordnet.', failed: 'Die Zuordnung ist nicht möglich. Bitte lade die Ansicht neu und prüfe die Angaben.',
  loading: 'Wird gespeichert …', reload: 'Neu laden',
  signup: 'Konto anlegen (optional)', signupIntro: 'Deine Anmeldung ist gespeichert. Mit einem Konto siehst du deine Kurse nach der E-Mail-Bestätigung im Lernraum.',
  signupSecurity: 'Wir verwenden dieselbe E-Mail-Adresse wie für deine Kursanmeldung. Bei einer gemeinsamen Familienadresse prüft die Schule die Zuordnung.',
  password: 'Passwort', passwordHint: 'Mindestens 8, höchstens 72 Zeichen.', native: 'Deine Erstsprache',
  create: 'Konto anlegen', creating: 'Konto wird erstellt …', existing: 'Ich habe bereits ein Konto', later: 'Später',
} as const
type Labels = { [K in keyof typeof de]: string }
const en: Labels = {
  title: 'Unresolved account associations', intro: 'For shared email addresses, personally verify which registration belongs to which account.',
  empty: 'No unresolved account associations.', account: 'Verified account', choose: 'Choose an account', assign: 'Confirm association',
  confirm: 'I have personally verified that this registration belongs to this account.',
  blocked: 'This account already has an association or bookings. Existing identities cannot be merged here.',
  bookings: 'Bookings', saved: 'The registration has been linked to the account.', failed: 'This association could not be saved. Please reload and check the details.',
  loading: 'Saving …', reload: 'Reload',
  signup: 'Create an account (optional)', signupIntro: 'Your registration is saved. Create an account to see your courses in your learning space after verifying your email.',
  signupSecurity: 'We use the same email address as your course registration. The school reviews associations for shared family addresses.',
  password: 'Password', passwordHint: 'At least 8 and at most 72 characters.', native: 'Your first language',
  create: 'Create account', creating: 'Creating account …', existing: 'I already have an account', later: 'Later',
}
const ru: Labels = {
  title: 'Непривязанные заявки', intro: 'Если адрес электронной почты используется несколькими людьми, лично проверьте, кому принадлежит заявка.',
  empty: 'Нет заявок, требующих привязки.', account: 'Подтверждённый аккаунт', choose: 'Выберите аккаунт', assign: 'Подтвердить привязку',
  confirm: 'Я лично проверил(а), что эта заявка принадлежит владельцу этого аккаунта.',
  blocked: 'Этот аккаунт уже привязан к ученику или имеет бронирования. Объединить данные здесь нельзя.',
  bookings: 'Бронирования', saved: 'Заявка привязана к аккаунту.', failed: 'Не удалось выполнить привязку. Обновите страницу и проверьте данные.',
  loading: 'Сохранение …', reload: 'Обновить',
  signup: 'Создать аккаунт (необязательно)', signupIntro: 'Твоя заявка сохранена. Создай аккаунт, чтобы после подтверждения почты видеть свои курсы в учебном пространстве.',
  signupSecurity: 'Мы используем ту же почту, что и в заявке на курс. Если это общий семейный адрес, школа проверит привязку лично.',
  password: 'Пароль', passwordHint: 'От 8 до 72 символов.', native: 'Твой родной язык',
  create: 'Создать аккаунт', creating: 'Создание аккаунта …', existing: 'У меня уже есть аккаунт', later: 'Позже',
}
const uk: Labels = {
  title: 'Неприв’язані заявки', intro: 'Якщо адресою електронної пошти користуються кілька людей, особисто перевірте, кому належить заявка.',
  empty: 'Немає заявок, що потребують прив’язки.', account: 'Підтверджений акаунт', choose: 'Виберіть акаунт', assign: 'Підтвердити прив’язку',
  confirm: 'Я особисто перевірив(ла), що ця заявка належить власнику цього акаунта.',
  blocked: 'Цей акаунт уже прив’язаний до учня або має бронювання. Об’єднати дані тут неможливо.',
  bookings: 'Бронювання', saved: 'Заявку прив’язано до акаунта.', failed: 'Не вдалося виконати прив’язку. Оновіть сторінку та перевірте дані.',
  loading: 'Збереження …', reload: 'Оновити',
  signup: 'Створити акаунт (необов’язково)', signupIntro: 'Твою заявку збережено. Створи акаунт, щоб після підтвердження пошти бачити свої курси в навчальному просторі.',
  signupSecurity: 'Ми використовуємо ту саму пошту, що й у заявці на курс. Якщо це спільна сімейна адреса, школа перевірить прив’язку особисто.',
  password: 'Пароль', passwordHint: 'Від 8 до 72 символів.', native: 'Твоя рідна мова',
  create: 'Створити акаунт', creating: 'Створення акаунта …', existing: 'У мене вже є акаунт', later: 'Пізніше',
}
const tr: Labels = {
  title: 'Hesap bağlantısı bekleyen kayıtlar', intro: 'Ortak e-posta adreslerinde hangi kaydın hangi hesaba ait olduğunu kişiyle görüşerek doğrulayın.',
  empty: 'Hesap bağlantısı bekleyen kayıt yok.', account: 'Doğrulanmış hesap', choose: 'Hesap seçin', assign: 'Bağlantıyı onayla',
  confirm: 'Bu kaydın bu hesabın sahibine ait olduğunu şahsen doğruladım.',
  blocked: 'Bu hesabın zaten bir bağlantısı veya rezervasyonları var. Mevcut kayıtlar burada birleştirilemez.',
  bookings: 'Rezervasyonlar', saved: 'Kayıt hesaba bağlandı.', failed: 'Bağlantı kaydedilemedi. Lütfen sayfayı yenileyip bilgileri kontrol edin.',
  loading: 'Kaydediliyor …', reload: 'Yenile',
  signup: 'Hesap oluştur (isteğe bağlı)', signupIntro: 'Kaydın alındı. E-postanı doğruladıktan sonra kurslarını öğrenme alanında görmek için hesap oluştur.',
  signupSecurity: 'Kurs kaydındaki e-posta adresini kullanıyoruz. Ortak aile adreslerinde bağlantıyı okul kontrol eder.',
  password: 'Şifre', passwordHint: 'En az 8, en fazla 72 karakter.', native: 'Ana dilin',
  create: 'Hesap oluştur', creating: 'Hesap oluşturuluyor …', existing: 'Zaten hesabım var', later: 'Daha sonra',
}
export const identityLabels = (lang: string): Labels => ({ de, en, ru, uk, tr })[toUiLocale(lang)]
