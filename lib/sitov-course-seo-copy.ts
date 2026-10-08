import type { CourseType } from '@/lib/course-config'
import { LOCALES } from '@/lib/locale-routing'

type SitovCourseLocale = (typeof LOCALES)[number]
type SitovCourseCopy = {
  title: string
  description: string
  heading: string
  intro: string
  asideTitle: string
  asideBody: string
  coursesTitle: string
  coursesDescription: string
  formatTitle: string
  features: { title: string; body: string }[]
  selectionTitle: string
  selectionBody: string
  faqs: { question: string; answer: string }[]
}

const sitovCommonCopy = {
  de: {
    navigation: 'Deutschkurse', presenceLink: 'Deutschkurse in Hannover', onlineLink: 'Deutschkurse online',
    chooseCourse: 'Aktuelle Kurse ansehen', contact: 'Zum passenden Kurs beraten lassen', faqsTitle: 'Fragen vor deiner Anmeldung',
    noCourses: 'Für diese Unterrichtsform ist gerade kein Kurs zur Anmeldung veröffentlicht. Schreib uns für den nächsten passenden Termin oder sieh dir die andere Unterrichtsform an.',
    arrangedTimes: 'Unterrichtszeiten nach Vereinbarung',
    trialNotice: 'Jede Person kann einmal eine kostenlose Probestunde in einem Kurs mit Probestundenangebot nutzen. Ob sie bereits genutzt wurde, prüfen wir beim Absenden. Online-Privatunterricht bietet keine kostenlose Probestunde.',
    platformTitle: 'Zwischen den Stunden weiterlernen',
    platformBody: 'Die Lernplattform ergänzt deinen Unterricht mit Vokabeln, Grammatik, Aussprache und weiteren Übungen. Die verfügbaren Inhalte und dein Lernfortschritt findest du nach der Anmeldung in deinem Lernraum.',
  },
  en: {
    navigation: 'German courses', presenceLink: 'German courses in Hannover', onlineLink: 'Online German courses',
    chooseCourse: 'See current courses', contact: 'Get help choosing a course', faqsTitle: 'Questions before you register',
    noCourses: 'No course is currently open for registration in this teaching format. Contact us about the next suitable date or explore the other format.',
    arrangedTimes: 'Lesson times by arrangement',
    trialNotice: 'Each person can take one free trial lesson in a course that offers trials. We check whether it has already been used when you submit the form. Online private lessons do not include a free trial.',
    platformTitle: 'Keep learning between lessons',
    platformBody: 'The learning platform complements your lessons with vocabulary, grammar, pronunciation and other exercises. After signing in, you can find your available learning content and progress in your learning space.',
  },
  ru: {
    navigation: 'Курсы немецкого', presenceLink: 'Курсы немецкого в Ганновере', onlineLink: 'Немецкий онлайн',
    chooseCourse: 'Посмотреть актуальные курсы', contact: 'Получить помощь с выбором курса', faqsTitle: 'Вопросы перед записью',
    noCourses: 'Сейчас для этого формата нет курсов, открытых для записи. Напишите нам о следующем подходящем занятии или посмотрите другой формат.',
    arrangedTimes: 'Время занятий по договорённости',
    trialNotice: 'Каждый человек может один раз посетить бесплатное пробное занятие в курсе, где оно предусмотрено. При отправке формы мы проверяем, было ли оно уже использовано. Для индивидуальных онлайн-занятий бесплатного пробного занятия нет.',
    platformTitle: 'Продолжайте учиться между занятиями',
    platformBody: 'Учебная платформа дополняет занятия упражнениями по лексике, грамматике и произношению. После входа в учебном кабинете вы увидите доступные материалы и свой прогресс.',
  },
  uk: {
    navigation: 'Курси німецької', presenceLink: 'Курси німецької в Ганновері', onlineLink: 'Німецька онлайн',
    chooseCourse: 'Переглянути актуальні курси', contact: 'Отримати допомогу з вибором курсу', faqsTitle: 'Запитання перед записом',
    noCourses: 'Зараз для цього формату немає курсів, відкритих для запису. Напишіть нам щодо наступного відповідного заняття або перегляньте інший формат.',
    arrangedTimes: 'Час занять за домовленістю',
    trialNotice: 'Кожна людина може один раз відвідати безкоштовне пробне заняття в курсі, де воно передбачене. Під час надсилання форми ми перевіряємо, чи його вже використано. Для індивідуальних онлайн-занять безкоштовного пробного заняття немає.',
    platformTitle: 'Продовжуйте вчитися між заняттями',
    platformBody: 'Навчальна платформа доповнює заняття вправами з лексики, граматики та вимови. Після входу в навчальному кабінеті ви побачите доступні матеріали та свій прогрес.',
  },
  tr: {
    navigation: 'Almanca kursları', presenceLink: 'Hannover’de Almanca kursları', onlineLink: 'Çevrim içi Almanca kursları',
    chooseCourse: 'Güncel kurslara bak', contact: 'Kurs seçimi için danış', faqsTitle: 'Kaydolmadan önce sorularınız',
    noCourses: 'Bu ders biçiminde şu anda kayıt alınan bir kurs bulunmuyor. Bir sonraki uygun ders için bize yazın veya diğer ders biçimine bakın.',
    arrangedTimes: 'Ders saatleri anlaşmaya göre',
    trialNotice: 'Her kişi, deneme dersi sunan bir kursta bir kez ücretsiz deneme dersine katılabilir. Form gönderildiğinde bu hakkın kullanılıp kullanılmadığını kontrol ederiz. Çevrim içi özel derslerde ücretsiz deneme dersi yoktur.',
    platformTitle: 'Dersler arasında öğrenmeye devam edin',
    platformBody: 'Öğrenme platformu derslerinizi kelime, dil bilgisi, telaffuz ve diğer alıştırmalarla destekler. Giriş yaptıktan sonra öğrenme alanınızda size açık içerikleri ve ilerlemenizi bulabilirsiniz.',
  },
} satisfies Record<SitovCourseLocale, Record<string, string>>

const sitovCourseCopy: Record<SitovCourseLocale, Record<CourseType, SitovCourseCopy>> = {
  de: {
    presence: {
      title: 'Deutschkurse in Hannover – Präsenz & Sprechtraining',
      description: 'Deutsch in Hannover lernen: Präsenzkurse und Sprechtraining bei Sitov Academy. Aktuelle Termine, Preise und Probestunden im Freizeitheim Vahrenwald ansehen.',
      heading: 'Deutschkurse in Hannover',
      intro: 'Lerne Deutsch im direkten Austausch mit deiner Lehrkraft und anderen Lernenden. Bei Sitov Academy findest du Präsenzunterricht und Sprechtraining in Hannover – mit aktuellen Terminen und Preisen für jeden veröffentlichten Kurs.',
      asideTitle: 'Dein Unterrichtsort in Hannover',
      asideBody: 'Unsere Präsenzkurse finden im Freizeitheim Vahrenwald statt. Die genauen Unterrichtszeiten stehen beim jeweiligen Kurs. Für die Anreise kannst du direkt eine Route planen.',
      coursesTitle: 'Aktuelle Präsenzkurse und Sprechtraining',
      coursesDescription: 'Vergleiche Unterrichtszeiten, Kursbeschreibung und Preis pro Einheit. Die Kurskarte führt zur Anmeldung für genau dieses Angebot.',
      formatTitle: 'Deutsch lernen im gemeinsamen Unterricht',
      features: [
        { title: 'Deutsch im Alltag anwenden', body: 'Im Kurs verbindest du Wortschatz und Grammatik mit dem Verstehen und Sprechen. Du kannst Fragen direkt mit deiner Lehrkraft besprechen und neue Formulierungen im Austausch üben.' },
        { title: 'Gezielt das Sprechen üben', body: 'Das Sprechtraining ist ein eigenes Angebot für mehr Gesprächspraxis. Die Kursbeschreibung zeigt, für welche Lernenden das jeweilige Training gedacht ist; Termine und Preise stehen in der Kurskarte.' },
        { title: 'Ein Termin, der zu dir passt', body: 'Präsenzunterricht hat feste, veröffentlichte Unterrichtszeiten. Vergleiche sie vor der Anmeldung mit deinem Alltag. Wenn du von zu Hause teilnehmen möchtest, sieh dir unsere Online-Kurse an.' },
      ],
      selectionTitle: 'Welcher Deutschkurs passt zu dir?',
      selectionBody: 'Wähle nach deinen bisherigen Deutschkenntnissen, deinem Lernziel und deiner verfügbaren Zeit. Kursbezeichnungen und Beschreibungen helfen bei der Orientierung. Wenn du dein Niveau noch nicht einschätzen kannst, schreib uns vor der Anmeldung – wir beraten dich zur Kurswahl.',
      faqs: [
        { question: 'Wo findet der Präsenzunterricht statt?', answer: 'Der Unterricht findet im Freizeitheim Vahrenwald, Vahrenwalder Str. 92, 30165 Hannover statt. Der Geschäftssitz der Sprachschule ist eine andere Adresse; für deinen Kurs gilt der hier angegebene Unterrichtsort.' },
        { question: 'Was kostet ein Deutschkurs in Hannover?', answer: 'Jede Kurskarte zeigt den aktuellen Preis pro Unterrichtseinheit und die Dauer der Einheit. Die Anmeldung zeigt die Buchungsdetails des ausgewählten Kurses. Vergleiche daher den konkreten Kurs statt eines allgemeinen Preisversprechens.' },
        { question: 'Kann ich den Kurs zuerst ausprobieren?', answer: 'Bei Kursen mit Probestundenangebot findest du einen eigenen Link zur Probestunde. Jede Person kann einmal eine kostenlose Probestunde nutzen; ob sie bereits genutzt wurde, prüfen wir beim Absenden des Formulars.' },
        { question: 'Wie melde ich mich an?', answer: 'Wähle eine Kurskarte und öffne die Anmeldung. Der Kurs ist dort vorausgewählt. Prüfe die Kurs- und Buchungsdetails und sende das Formular ab. Bei Fragen zu deinem Niveau oder den Terminen kannst du uns vorher kontaktieren.' },
      ],
    },
    online: {
      title: 'Deutschkurse online – Live-Unterricht & Lernplattform',
      description: 'Deutsch online mit Lehrkraft lernen: aktuelle Live-Kurse und Privatunterricht bei Sitov Academy. Termine, Preise und mögliche Probestunden vergleichen.',
      heading: 'Deutschkurse online mit Lehrkraft',
      intro: 'Lerne Deutsch per Videokonferenz und übe im direkten Austausch mit deiner Lehrkraft. Hier findest du die aktuell angebotenen Online-Kurse und den Online-Privatunterricht von Sitov Academy – mit konkreten Unterrichtszeiten und Preisen.',
      asideTitle: 'Live-Unterricht von deinem Lernplatz aus',
      asideBody: 'Für die Teilnahme brauchst du eine stabile Internetverbindung, ein Mikrofon und ein geeignetes Gerät für die Videokonferenz. Wähle einen ruhigen Platz, an dem du hören, sprechen und mitarbeiten kannst.',
      coursesTitle: 'Aktuelle Online-Kurse',
      coursesDescription: 'Hier erscheinen nur aktuell angebotene Online-Kurse. Niveau, Unterrichtszeiten, Preis und Probestundenangebot richten sich nach dem einzelnen Kurs.',
      formatTitle: 'Gemeinsam online Deutsch lernen',
      features: [
        { title: 'Mit deiner Lehrkraft im Gespräch', body: 'Online-Unterricht findet live statt. Du hörst zu, sprichst selbst und kannst Fragen stellen. Welche Schwerpunkte ein Kurs setzt, steht in seiner Beschreibung.' },
        { title: 'Gruppe oder Privatunterricht', body: 'Vergleiche die veröffentlichten Gruppenkurse mit dem Online-Privatunterricht. Privatunterricht hat keine festen Gruppentermine; die Unterrichtszeiten werden vereinbart. Eine kostenlose Probestunde ist dafür nicht vorgesehen.' },
        { title: 'Den Unterricht vorbereiten', body: 'Prüfe Internet, Mikrofon und Ton vor deiner ersten Stunde. Halte die benötigten Materialien bereit und plane die veröffentlichten Unterrichtszeiten verbindlich in deinen Alltag ein.' },
      ],
      selectionTitle: 'Finde dein passendes Online-Angebot',
      selectionBody: 'Entscheidend sind deine Deutschkenntnisse, dein Lernziel und die Zeiten, zu denen du regelmäßig teilnehmen kannst. Die aktuell verfügbaren Niveaus stehen bei den Angeboten. Ist kein passender Kurs dabei oder bist du unsicher, kontaktiere uns zur Auswahl. Für Unterricht vor Ort findest du außerdem unsere Deutschkurse in Hannover.',
      faqs: [
        { question: 'Sind die Online-Kurse live oder aufgezeichnet?', answer: 'Die hier angebotenen Online-Kurse sind Live-Unterricht mit einer Lehrkraft per Videokonferenz. Die Lernplattform ergänzt den Unterricht mit Übungen, die du selbstständig bearbeiten kannst.' },
        { question: 'Welche Deutsch-Niveaus sind online verfügbar?', answer: 'Die aktuell buchbaren Kurse und ihre Beschreibungen stehen auf dieser Seite. Das Angebot kann sich ändern. Wenn du dein gewünschtes Niveau nicht findest, frag uns nach einer passenden Möglichkeit.' },
        { question: 'Kann ich eine kostenlose Online-Probestunde buchen?', answer: 'Bei Online-Kursen mit Probestundenangebot führt ein eigener Link zum Formular. Jede Person kann einmal eine kostenlose Probestunde nutzen; die Prüfung erfolgt beim Absenden. Online-Privatunterricht bietet keine kostenlose Probestunde.' },
        { question: 'Was kostet der Online-Unterricht?', answer: 'Die Kurskarten zeigen den Preis pro Unterrichtseinheit und deren Dauer. Bei Gruppenkursen stehen auch die Unterrichtszeiten dabei. Online-Privatunterricht wird zu vereinbarten Zeiten angeboten. Die Anmeldung zeigt die Buchungsdetails für den ausgewählten Kurs.' },
      ],
    },
  },
  en: {
    presence: {
      title: 'German courses in Hannover – In-person lessons',
      description: 'Learn German in Hannover with Sitov Academy. Explore current in-person courses, speaking practice, lesson times, prices and trial lessons in Vahrenwald.',
      heading: 'German courses in Hannover',
      intro: 'Learn German through direct conversation with your teacher and other learners. Sitov Academy offers in-person lessons and speaking practice in Hannover, with current lesson times and prices for every published course.',
      asideTitle: 'Your classroom in Hannover',
      asideBody: 'Our in-person courses take place at Freizeitheim Vahrenwald. Each course lists its own lesson times. Use the directions link to plan your journey.',
      coursesTitle: 'Current in-person courses and speaking practice',
      coursesDescription: 'Compare lesson times, course descriptions and the price per lesson unit. Each course card takes you to registration for that specific course.',
      formatTitle: 'Learn German together in the classroom',
      features: [
        { title: 'Use German in everyday life', body: 'Lessons connect vocabulary and grammar with listening and speaking. Discuss questions directly with your teacher and practise new expressions with other learners.' },
        { title: 'Focus on speaking', body: 'Speaking practice is a separate offer for more conversation. Each course description explains who the session is for; the card lists its lesson times and price.' },
        { title: 'Choose times that suit you', body: 'In-person courses have published lesson times. Check that they fit your routine before registering. If you prefer to join from home, explore our online courses.' },
      ],
      selectionTitle: 'Which German course is right for you?',
      selectionBody: 'Consider your current German, your learning goal and your available time. Course names and descriptions help you choose. If you are unsure of your level, contact us before registering for advice on the right course.',
      faqs: [
        { question: 'Where do in-person lessons take place?', answer: 'Lessons take place at Freizeitheim Vahrenwald, Vahrenwalder Str. 92, 30165 Hannover. The school’s registered business address is different; use the classroom address shown here for your course.' },
        { question: 'How much does a German course in Hannover cost?', answer: 'Each course card shows the current price per lesson unit and its duration. Registration shows the booking details of your chosen course, so compare the specific offer.' },
        { question: 'Can I try a course first?', answer: 'Courses that offer trial lessons have a separate trial link. Each person can take one free trial lesson. We check whether it has already been used when the form is submitted.' },
        { question: 'How do I register?', answer: 'Choose a course card and open registration. Your course is preselected. Review the course and booking details before submitting the form. Contact us beforehand if you have questions about your level or lesson times.' },
      ],
    },
    online: {
      title: 'Online German courses – Live lessons & learning platform',
      description: 'Learn German online with a teacher at Sitov Academy. Compare current live courses, private lessons, schedules, prices and available trial lessons.',
      heading: 'Online German courses with a teacher',
      intro: 'Learn German by video conference and practise directly with your teacher. Explore Sitov Academy’s current online courses and online private lessons, with specific lesson times and prices.',
      asideTitle: 'Live lessons from your own learning space',
      asideBody: 'You need a stable internet connection, a microphone and a device suitable for video conferencing. Choose a quiet place where you can listen, speak and participate.',
      coursesTitle: 'Current online courses',
      coursesDescription: 'Only currently offered online courses appear here. The level, schedule, price and trial availability depend on each individual course.',
      formatTitle: 'Learn German together online',
      features: [
        { title: 'Talk with your teacher', body: 'Online lessons take place live. Listen, speak and ask questions. Each course description explains its focus.' },
        { title: 'Group or private lessons', body: 'Compare published group courses with online private lessons. Private lessons have individually arranged times rather than a group timetable and do not offer a free trial.' },
        { title: 'Get ready for your lesson', body: 'Check your connection, microphone and sound before your first lesson. Prepare your materials and set aside the published lesson times in your routine.' },
      ],
      selectionTitle: 'Find the right online option',
      selectionBody: 'Choose according to your current German, your learning goal and when you can attend regularly. Available levels are shown with the courses. Contact us if you are unsure or cannot find a suitable course. For classroom learning, explore our German courses in Hannover.',
      faqs: [
        { question: 'Are online courses live or prerecorded?', answer: 'These online courses are live video lessons with a teacher. The learning platform complements them with exercises you can work on independently.' },
        { question: 'Which German levels are available online?', answer: 'This page lists the courses currently open for booking and their descriptions. The selection can change. Contact us if your desired level is not listed.' },
        { question: 'Can I book a free online trial lesson?', answer: 'Online courses that offer trials have a separate form link. Each person can take one free trial lesson; eligibility is checked when the form is submitted. Online private lessons do not include a free trial.' },
        { question: 'How much do online lessons cost?', answer: 'The cards show the price per lesson unit and its duration. Group courses also show lesson times. Private lessons take place at arranged times. Registration shows the booking details of your selected course.' },
      ],
    },
  },
  ru: {
    presence: {
      title: 'Курсы немецкого в Ганновере – Очное обучение',
      description: 'Учите немецкий в Ганновере с Sitov Academy. Актуальные очные курсы и разговорная практика: расписание, цены и пробные занятия в Vahrenwald.',
      heading: 'Курсы немецкого в Ганновере',
      intro: 'Учите немецкий в живом общении с преподавателем и другими учащимися. Sitov Academy предлагает очные занятия и разговорную практику в Ганновере. Для каждого опубликованного курса указаны актуальные расписание и цена.',
      asideTitle: 'Где проходят занятия в Ганновере',
      asideBody: 'Очные курсы проходят в Freizeitheim Vahrenwald. Время занятий указано у каждого курса. Воспользуйтесь ссылкой на маршрут, чтобы спланировать дорогу.',
      coursesTitle: 'Актуальные очные курсы и разговорная практика',
      coursesDescription: 'Сравните расписание, описание и цену за учебную единицу. Карточка ведёт к записи именно на выбранный курс.',
      formatTitle: 'Учите немецкий вместе в классе',
      features: [
        { title: 'Немецкий для повседневного общения', body: 'На занятиях лексика и грамматика сочетаются с пониманием речи и разговором. Обсуждайте вопросы с преподавателем и практикуйте новые выражения с другими учащимися.' },
        { title: 'Больше разговорной практики', body: 'Разговорный тренинг — отдельное предложение для практики общения. Описание объясняет, для кого подходит занятие, а карточка показывает расписание и цену.' },
        { title: 'Удобное время занятий', body: 'Очные курсы проходят по опубликованному расписанию. Перед записью проверьте, подходит ли оно вам. Если хотите заниматься из дома, посмотрите онлайн-курсы.' },
      ],
      selectionTitle: 'Какой курс немецкого вам подходит?',
      selectionBody: 'Учитывайте свои знания немецкого, цель обучения и свободное время. Названия и описания курсов помогут с выбором. Если вы не уверены в своём уровне, напишите нам до записи — мы поможем подобрать курс.',
      faqs: [
        { question: 'Где проходят очные занятия?', answer: 'Занятия проходят в Freizeitheim Vahrenwald, Vahrenwalder Str. 92, 30165 Hannover. Юридический адрес школы другой; для посещения курса используйте указанный здесь адрес учебного помещения.' },
        { question: 'Сколько стоит курс немецкого в Ганновере?', answer: 'В карточке каждого курса указаны актуальная цена за учебную единицу и её длительность. При записи вы увидите условия бронирования выбранного курса.' },
        { question: 'Можно сначала попробовать курс?', answer: 'У курсов с пробным занятием есть отдельная ссылка для записи. Каждый человек может один раз посетить бесплатное пробное занятие. При отправке формы мы проверяем, было ли оно уже использовано.' },
        { question: 'Как записаться?', answer: 'Выберите карточку курса и откройте форму записи. Курс уже будет выбран. Проверьте сведения и условия записи, затем отправьте форму. Если есть вопросы об уровне или расписании, сначала свяжитесь с нами.' },
      ],
    },
    online: {
      title: 'Немецкий онлайн – Занятия с преподавателем',
      description: 'Учите немецкий онлайн с преподавателем Sitov Academy. Сравните актуальные групповые и индивидуальные занятия, расписание, цены и пробные уроки.',
      heading: 'Немецкий онлайн с преподавателем',
      intro: 'Учите немецкий по видеосвязи и практикуйтесь в прямом общении с преподавателем. Здесь представлены актуальные онлайн-курсы и индивидуальные онлайн-занятия Sitov Academy с конкретными расписанием и ценами.',
      asideTitle: 'Живые занятия из удобного места',
      asideBody: 'Нужны стабильный интернет, микрофон и устройство для видеосвязи. Выберите тихое место, где сможете слушать, говорить и участвовать в уроке.',
      coursesTitle: 'Актуальные онлайн-курсы',
      coursesDescription: 'Здесь показаны только действующие онлайн-предложения. Уровень, расписание, цена и возможность пробного занятия зависят от конкретного курса.',
      formatTitle: 'Учите немецкий вместе онлайн',
      features: [
        { title: 'Разговор с преподавателем', body: 'Онлайн-занятия проходят вживую. Вы слушаете, говорите и задаёте вопросы. Направленность каждого курса указана в его описании.' },
        { title: 'Группа или индивидуальные занятия', body: 'Сравните групповые курсы с индивидуальными онлайн-занятиями. Время индивидуальных уроков согласуется отдельно; бесплатное пробное занятие для них не предусмотрено.' },
        { title: 'Подготовьтесь к уроку', body: 'Перед первым уроком проверьте интернет, микрофон и звук. Подготовьте материалы и заранее выделите время для занятий по опубликованному расписанию.' },
      ],
      selectionTitle: 'Подберите подходящий онлайн-курс',
      selectionBody: 'Важны ваши знания немецкого, цель и время для регулярных занятий. Доступные уровни указаны у курсов. Если подходящего курса нет или выбор вызывает вопросы, напишите нам. Для занятий в классе посмотрите курсы немецкого в Ганновере.',
      faqs: [
        { question: 'Онлайн-курсы проходят вживую или в записи?', answer: 'Это живые занятия с преподавателем по видеосвязи. Учебная платформа дополняет их упражнениями для самостоятельной работы.' },
        { question: 'Какие уровни немецкого доступны онлайн?', answer: 'На этой странице представлены курсы, на которые сейчас можно записаться, и их описания. Предложения могут меняться. Если нужного уровня нет, свяжитесь с нами.' },
        { question: 'Можно записаться на бесплатное онлайн-пробное занятие?', answer: 'Для курсов с пробным занятием есть отдельная ссылка на форму. Каждый человек может один раз посетить бесплатное пробное занятие; проверка выполняется при отправке формы. Для индивидуальных онлайн-занятий бесплатного пробного урока нет.' },
        { question: 'Сколько стоят онлайн-занятия?', answer: 'Карточки показывают цену за учебную единицу и её длительность. Для групп также указано расписание. Время индивидуальных уроков согласуется отдельно. Условия записи показаны в форме выбранного курса.' },
      ],
    },
  },
  uk: {
    presence: {
      title: 'Курси німецької в Ганновері – Очне навчання',
      description: 'Вивчайте німецьку в Ганновері з Sitov Academy. Актуальні очні курси та розмовна практика: розклад, ціни та пробні заняття у Vahrenwald.',
      heading: 'Курси німецької в Ганновері',
      intro: 'Вивчайте німецьку в живому спілкуванні з викладачем та іншими учнями. Sitov Academy пропонує очні заняття й розмовну практику в Ганновері. Для кожного опублікованого курсу вказані актуальний розклад і ціна.',
      asideTitle: 'Де проходять заняття в Ганновері',
      asideBody: 'Очні курси проходять у Freizeitheim Vahrenwald. Час занять указаний біля кожного курсу. Скористайтеся посиланням на маршрут, щоб спланувати дорогу.',
      coursesTitle: 'Актуальні очні курси та розмовна практика',
      coursesDescription: 'Порівняйте розклад, опис і ціну за навчальну одиницю. Картка веде до запису саме на вибраний курс.',
      formatTitle: 'Вивчайте німецьку разом у класі',
      features: [
        { title: 'Німецька для повсякденного спілкування', body: 'На заняттях лексика й граматика поєднуються з розумінням мовлення та розмовою. Обговорюйте запитання з викладачем і практикуйте нові вислови з іншими учнями.' },
        { title: 'Більше розмовної практики', body: 'Розмовний тренінг — окрема пропозиція для практики спілкування. Опис пояснює, кому підходить заняття, а картка показує розклад і ціну.' },
        { title: 'Зручний час занять', body: 'Очні курси проходять за опублікованим розкладом. Перед записом перевірте, чи він вам підходить. Якщо хочете навчатися вдома, перегляньте онлайн-курси.' },
      ],
      selectionTitle: 'Який курс німецької вам підходить?',
      selectionBody: 'Враховуйте свої знання німецької, мету навчання та вільний час. Назви й описи курсів допоможуть із вибором. Якщо ви не впевнені у своєму рівні, напишіть нам до запису — ми допоможемо підібрати курс.',
      faqs: [
        { question: 'Де проходять очні заняття?', answer: 'Заняття проходять у Freizeitheim Vahrenwald, Vahrenwalder Str. 92, 30165 Hannover. Юридична адреса школи інша; для відвідування курсу використовуйте вказану тут адресу навчального приміщення.' },
        { question: 'Скільки коштує курс німецької в Ганновері?', answer: 'У картці кожного курсу вказані актуальна ціна за навчальну одиницю та її тривалість. Під час запису ви побачите умови бронювання вибраного курсу.' },
        { question: 'Чи можна спочатку спробувати курс?', answer: 'Для курсів із пробним заняттям є окреме посилання для запису. Кожна людина може один раз відвідати безкоштовне пробне заняття. Під час надсилання форми ми перевіряємо, чи його вже використано.' },
        { question: 'Як записатися?', answer: 'Виберіть картку курсу та відкрийте форму запису. Курс уже буде вибрано. Перевірте відомості й умови, потім надішліть форму. Якщо є запитання про рівень або розклад, спочатку зв’яжіться з нами.' },
      ],
    },
    online: {
      title: 'Німецька онлайн – Заняття з викладачем',
      description: 'Вивчайте німецьку онлайн з викладачем Sitov Academy. Порівняйте актуальні групові та індивідуальні заняття, розклад, ціни й пробні уроки.',
      heading: 'Німецька онлайн з викладачем',
      intro: 'Вивчайте німецьку через відеозв’язок і практикуйтеся в прямому спілкуванні з викладачем. Тут представлені актуальні онлайн-курси та індивідуальні онлайн-заняття Sitov Academy з конкретним розкладом і цінами.',
      asideTitle: 'Живі заняття зі зручного місця',
      asideBody: 'Потрібні стабільний інтернет, мікрофон і пристрій для відеозв’язку. Виберіть тихе місце, де зможете слухати, говорити й брати участь в уроці.',
      coursesTitle: 'Актуальні онлайн-курси',
      coursesDescription: 'Тут показані лише поточні онлайн-пропозиції. Рівень, розклад, ціна та можливість пробного заняття залежать від конкретного курсу.',
      formatTitle: 'Вивчайте німецьку разом онлайн',
      features: [
        { title: 'Розмова з викладачем', body: 'Онлайн-заняття проходять наживо. Ви слухаєте, говорите й ставите запитання. Спрямованість кожного курсу вказана в його описі.' },
        { title: 'Група або індивідуальні заняття', body: 'Порівняйте групові курси з індивідуальними онлайн-заняттями. Час індивідуальних уроків узгоджується окремо; безкоштовне пробне заняття для них не передбачене.' },
        { title: 'Підготуйтеся до уроку', body: 'Перед першим уроком перевірте інтернет, мікрофон і звук. Підготуйте матеріали й заздалегідь виділіть час для занять за опублікованим розкладом.' },
      ],
      selectionTitle: 'Підберіть відповідний онлайн-курс',
      selectionBody: 'Важливі ваші знання німецької, мета й час для регулярних занять. Доступні рівні вказані біля курсів. Якщо відповідного курсу немає або вибір викликає запитання, напишіть нам. Для занять у класі перегляньте курси німецької в Ганновері.',
      faqs: [
        { question: 'Онлайн-курси проходять наживо чи в записі?', answer: 'Це живі заняття з викладачем через відеозв’язок. Навчальна платформа доповнює їх вправами для самостійної роботи.' },
        { question: 'Які рівні німецької доступні онлайн?', answer: 'На цій сторінці представлені курси, на які зараз можна записатися, та їхні описи. Пропозиції можуть змінюватися. Якщо потрібного рівня немає, зв’яжіться з нами.' },
        { question: 'Чи можна записатися на безкоштовне пробне онлайн-заняття?', answer: 'Для курсів із пробним заняттям є окреме посилання на форму. Кожна людина може один раз відвідати безкоштовне пробне заняття; перевірка відбувається під час надсилання форми. Для індивідуальних онлайн-занять безкоштовного пробного уроку немає.' },
        { question: 'Скільки коштують онлайн-заняття?', answer: 'Картки показують ціну за навчальну одиницю та її тривалість. Для груп також указаний розклад. Час індивідуальних уроків узгоджується окремо. Умови запису показані у формі вибраного курсу.' },
      ],
    },
  },
  tr: {
    presence: {
      title: 'Hannover’de Almanca kursları – Yüz yüze dersler',
      description: 'Sitov Academy ile Hannover’de Almanca öğrenin. Vahrenwald’daki güncel yüz yüze kursları, konuşma pratiğini, saatleri, ücretleri ve deneme derslerini inceleyin.',
      heading: 'Hannover’de Almanca kursları',
      intro: 'Öğretmeniniz ve diğer öğrencilerle doğrudan iletişim kurarak Almanca öğrenin. Sitov Academy, Hannover’de yüz yüze dersler ve konuşma pratiği sunar. Yayımlanan her kursun güncel saatlerini ve ücretini burada bulabilirsiniz.',
      asideTitle: 'Hannover’de ders yeriniz',
      asideBody: 'Yüz yüze kurslarımız Freizeitheim Vahrenwald’da yapılır. Her kursun ders saatleri ayrı gösterilir. Yol tarifi bağlantısıyla ulaşımınızı planlayabilirsiniz.',
      coursesTitle: 'Güncel yüz yüze kurslar ve konuşma pratiği',
      coursesDescription: 'Ders saatlerini, açıklamaları ve ders birimi ücretlerini karşılaştırın. Her kart sizi seçtiğiniz kursun kayıt formuna götürür.',
      formatTitle: 'Sınıfta birlikte Almanca öğrenin',
      features: [
        { title: 'Günlük yaşamda Almanca kullanın', body: 'Derslerde kelime ve dil bilgisi, dinleme ve konuşmayla birleştirilir. Sorularınızı öğretmeninizle görüşebilir ve yeni ifadeleri diğer öğrencilerle çalışabilirsiniz.' },
        { title: 'Konuşmaya odaklanın', body: 'Konuşma pratiği ayrı bir ders seçeneğidir. Kurs açıklaması dersin kimler için uygun olduğunu, kartı ise saatleri ve ücreti gösterir.' },
        { title: 'Size uygun bir saat seçin', body: 'Yüz yüze kursların yayımlanmış ders saatleri vardır. Kaydolmadan önce günlük düzeninize uyup uymadığını kontrol edin. Evden katılmak istiyorsanız çevrim içi kurslarımıza bakın.' },
      ],
      selectionTitle: 'Hangi Almanca kursu size uygun?',
      selectionBody: 'Mevcut Almanca bilginizi, öğrenme hedefinizi ve ayırabileceğiniz zamanı dikkate alın. Kurs adları ve açıklamaları seçim yapmanıza yardımcı olur. Seviyenizden emin değilseniz kaydolmadan önce bize yazın; kurs seçimi konusunda yardımcı olalım.',
      faqs: [
        { question: 'Yüz yüze dersler nerede yapılır?', answer: 'Dersler Freizeitheim Vahrenwald, Vahrenwalder Str. 92, 30165 Hannover adresinde yapılır. Okulun kayıtlı iş adresi farklıdır; kursunuz için burada gösterilen ders adresini kullanın.' },
        { question: 'Hannover’de Almanca kursu ne kadar?', answer: 'Her kart ders birimi başına güncel ücreti ve birimin süresini gösterir. Seçtiğiniz kursun kayıt ayrıntıları formda yer alır.' },
        { question: 'Kursu önce deneyebilir miyim?', answer: 'Deneme dersi sunan kurslarda ayrı bir deneme bağlantısı bulunur. Her kişi bir kez ücretsiz deneme dersine katılabilir. Form gönderildiğinde bu hakkın kullanılıp kullanılmadığı kontrol edilir.' },
        { question: 'Nasıl kaydolurum?', answer: 'Bir kurs kartını seçip kayıt formunu açın. Kursunuz önceden seçilmiş olur. Kurs ve kayıt ayrıntılarını kontrol edip formu gönderin. Seviye veya saatlerle ilgili sorularınız varsa önce bizimle iletişime geçin.' },
      ],
    },
    online: {
      title: 'Çevrim içi Almanca kursları – Canlı dersler',
      description: 'Sitov Academy öğretmenleriyle çevrim içi Almanca öğrenin. Güncel canlı kursları, özel dersleri, saatleri, ücretleri ve deneme dersi seçeneklerini karşılaştırın.',
      heading: 'Öğretmenle çevrim içi Almanca kursları',
      intro: 'Görüntülü görüşmeyle Almanca öğrenin ve öğretmeninizle doğrudan konuşarak pratik yapın. Sitov Academy’nin güncel çevrim içi kurslarını ve özel derslerini, belirli ders saatleri ve ücretleriyle burada bulabilirsiniz.',
      asideTitle: 'Kendi çalışma alanınızdan canlı dersler',
      asideBody: 'Sabit bir internet bağlantısına, mikrofona ve görüntülü görüşme için uygun bir cihaza ihtiyacınız var. Dinleyebileceğiniz, konuşabileceğiniz ve derse katılabileceğiniz sessiz bir yer seçin.',
      coursesTitle: 'Güncel çevrim içi kurslar',
      coursesDescription: 'Burada yalnızca şu anda sunulan çevrim içi kurslar gösterilir. Seviye, saatler, ücret ve deneme dersi seçeneği her kursa göre değişir.',
      formatTitle: 'Birlikte çevrim içi Almanca öğrenin',
      features: [
        { title: 'Öğretmeninizle konuşun', body: 'Çevrim içi dersler canlı yapılır. Dinler, konuşur ve soru sorarsınız. Her kursun odağı açıklamasında belirtilir.' },
        { title: 'Grup veya özel ders', body: 'Yayımlanan grup kurslarını çevrim içi özel derslerle karşılaştırın. Özel derslerin saatleri ayrıca kararlaştırılır; bu derslerde ücretsiz deneme dersi sunulmaz.' },
        { title: 'Derse hazırlanın', body: 'İlk dersten önce bağlantınızı, mikrofonunuzu ve sesinizi kontrol edin. Materyallerinizi hazırlayın ve yayımlanan ders saatlerine günlük düzeninizde yer ayırın.' },
      ],
      selectionTitle: 'Size uygun çevrim içi seçeneği bulun',
      selectionBody: 'Almanca bilginiz, öğrenme hedefiniz ve düzenli katılabileceğiniz saatler önemlidir. Mevcut seviyeler kurslarda gösterilir. Uygun kurs bulamıyorsanız veya kararsızsanız bize yazın. Sınıfta öğrenmek için Hannover’deki Almanca kurslarımıza da bakabilirsiniz.',
      faqs: [
        { question: 'Çevrim içi kurslar canlı mı, kayıt mı?', answer: 'Bu kurslar öğretmenle canlı görüntülü derslerdir. Öğrenme platformu dersleri kendi başınıza yapabileceğiniz alıştırmalarla destekler.' },
        { question: 'Hangi Almanca seviyeleri çevrim içi sunuluyor?', answer: 'Bu sayfada şu anda kayıt alınan kurslar ve açıklamaları yer alır. Seçenekler değişebilir. İstediğiniz seviye gösterilmiyorsa bize danışın.' },
        { question: 'Ücretsiz çevrim içi deneme dersine kaydolabilir miyim?', answer: 'Deneme dersi sunan çevrim içi kurslarda ayrı bir form bağlantısı vardır. Her kişi bir kez ücretsiz deneme dersine katılabilir; uygunluk form gönderildiğinde kontrol edilir. Çevrim içi özel derslerde ücretsiz deneme dersi yoktur.' },
        { question: 'Çevrim içi dersler ne kadar?', answer: 'Kartlar ders birimi başına ücreti ve süresini gösterir. Grup kurslarında ders saatleri de bulunur. Özel dersler kararlaştırılan saatlerde yapılır. Seçtiğiniz kursun kayıt ayrıntıları formda gösterilir.' },
      ],
    },
  },
}

function sitovCourseLocale(lang: string): SitovCourseLocale {
  return (LOCALES as readonly string[]).includes(lang) ? lang as SitovCourseLocale : 'de'
}

export function getSitovCourseSeoCopy(lang: string, type: CourseType) {
  const locale = sitovCourseLocale(lang)
  return { ...sitovCommonCopy[locale], ...sitovCourseCopy[locale][type] }
}

export function getSitovCourseLinks(lang: string) {
  const copy = sitovCommonCopy[sitovCourseLocale(lang)]
  return {
    label: copy.navigation,
    links: [
      { href: `/${lang}/deutschkurse-hannover`, label: copy.presenceLink },
      { href: `/${lang}/deutschkurse-online`, label: copy.onlineLink },
    ],
  }
}

export function sitovCoursePagePath(type: CourseType) {
  return type === 'presence' ? '/deutschkurse-hannover' as const : '/deutschkurse-online' as const
}
