-- Require recording consent for new online group registrations/trials.
-- Existing bookings and their recorded choices are preserved. The deployment
-- runner owns the transaction; no consent is inferred or backfilled.
-- Normalize the frozen multilingual notice once. A version is never silently
-- overwritten; mismatched text aborts the whole runner-owned transaction.
CREATE TABLE IF NOT EXISTS business_private.sitov_recording_notices (
 version text PRIMARY KEY CHECK(length(version) BETWEEN 1 AND 100),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND payload->>'version' IS NOT DISTINCT FROM version)
);
ALTER TABLE business_private.sitov_recording_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_private.sitov_recording_notices FROM PUBLIC,anon,authenticated,service_role;
DO $sitov_notice_snapshot$
DECLARE frozen_notice jsonb:=$sitov_recording_notice${
  "version": "sitov-recording-2026-10-04-v1",
  "translations": {
    "de": {
      "registration": {
        "summary": "Ich stimme der Aufzeichnung meiner Stimme und meines Bildes in Microsoft Teams zur späteren Ansicht durch die Teilnehmer der ausgewählten Online-Gruppenkurse zu.",
        "notice": "Reguläre Online-Gruppenkurse und Online-Probestunden werden immer in Microsoft Teams aufgezeichnet. Diese Zustimmung ist Voraussetzung für diese Buchung und muss einzeln bestätigt werden. Online-Privatunterricht ist ausgenommen.",
        "full": "Ich stimme der Aufzeichnung meiner Stimme und meines Bildes im gebuchten regulären Online-Gruppenkurs oder in der Online-Probestunde über Microsoft Teams zu. Die Aufnahme dient den Teilnehmern desselben Kurses zur späteren Wiederholung. Diese Zustimmung ist Voraussetzung für diese Buchung; Online-Privatunterricht ist ausgenommen. Ich kann die Zustimmung jederzeit für die Zukunft unter info@sitov-academy.com oder gegenüber der Lehrkraft widerrufen."
      },
      "monthly": {
        "summary": "Ich stimme der Aufzeichnung meiner Stimme und meines Bildes in Microsoft Teams zur späteren Ansicht durch die Teilnehmer der ausgewählten Online-Gruppenkurse zu.",
        "notice": "Reguläre Online-Gruppenkurse und Online-Probestunden werden immer in Microsoft Teams aufgezeichnet. Diese Zustimmung ist Voraussetzung für diese Buchung und muss einzeln bestätigt werden. Online-Privatunterricht ist ausgenommen.",
        "withdrawal": "Du kannst die Zustimmung jederzeit für die Zukunft unter info@sitov-academy.com oder gegenüber der Lehrkraft widerrufen."
      },
      "privacy": {
        "title": "9. Videokonferenz-Tools und Unterrichtsaufzeichnungen (Microsoft Teams)",
        "content": [
          "Für unseren Online-Unterricht nutzen wir Microsoft Teams. Reguläre Online-Gruppenkurse und Online-Probestunden werden immer für die spätere Ansicht durch die Teilnehmer desselben Kurses aufgezeichnet. Online-Privatunterricht ist von dieser Aufzeichnungsregel ausgenommen.",
          "Anbieter: Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irland (Mutterunternehmen: Microsoft Corporation, USA).",
          "9.1 Art und Zweck der Verarbeitung",
          "Bei der Nutzung von Microsoft Teams werden verschiedene Datenarten verarbeitet. Der Umfang der Daten hängt dabei auch davon ab, welche Angaben zu Daten Sie vor bzw. bei der Teilnahme an einer Online-Sitzung machen.",
          "Verarbeitete Daten: Meeting-Metadaten (z.B. Datum, Uhrzeit, Meeting-ID), Audio- und Videodaten (Ihre Stimme und Ihr Bild), Texteingaben (Chatfunktion) sowie Videoaufzeichnungen der Unterrichtssitzungen.",
          "Zweck der Aufzeichnung: Die Aufzeichnungen dienen ausschließlich den Teilnehmern des jeweiligen Kurses zur Nachbereitung und Wiederholung der Lerninhalte.",
          "9.2 Rechtsgrundlage",
          "Die Nutzung von Microsoft Teams zur allgemeinen Durchführung des Unterrichts basiert auf Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).",
          "Für die Aufzeichnung Ihrer Stimme und Ihres Bildes holen wir bei der Anmeldung eine gesonderte ausdrückliche Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO ein. Die Anmeldung zu regulären Online-Gruppenkursen und Online-Probestunden setzt diese Zustimmung voraus. Die Checkbox ist anfangs nicht ausgewählt und muss einzeln bestätigt werden; die Bestätigung anderer Pflichtpunkte setzt sie nicht. Online-Privatunterricht ist ausgenommen.",
          "9.3 Speicherdauer und Zugriff",
          "Die Videoaufzeichnungen werden in einer geschützten Umgebung (z.B. passwortgeschützter Cloud-Speicher von Microsoft) gespeichert. Der Zugriff ist streng auf die Lehrkraft und die angemeldeten Teilnehmer desselben Kurses beschränkt. Eine Weitergabe an Dritte erfolgt nicht.",
          "Die Aufnahmen werden spätestens 30 Tage nach Abschluss des jeweiligen Kurses dauerhaft gelöscht.",
          "9.4 Widerruf der Einwilligung",
          "Sie können Ihre Einwilligung zur Aufzeichnung jederzeit mit Wirkung für die Zukunft unter info@sitov-academy.com oder gegenüber der Lehrkraft widerrufen. Informieren Sie die Lehrkraft vor der Online-Sitzung über eine fehlende oder widerrufene Einwilligung. Vor einer Aufnahme muss die Lehrkraft prüfen, dass nur Personen mit wirksamer Einwilligung erfasst werden; andernfalls darf die betreffende Aufnahme nicht stattfinden.",
          "9.5 Datenübertragung in Drittländer (USA)",
          "Bei der Nutzung von Microsoft Teams kann es zu einer Datenverarbeitung in den USA kommen. Die Übermittlung basiert auf dem EU-US Data Privacy Framework (DPF) sowie ergänzend auf Standardvertragsklauseln (SCCs). Microsoft ist nach dem DPF zertifiziert. Bitte beachten Sie die allgemeinen Risiken eines Drittlandtransfers (theoretische Zugriffsmöglichkeiten durch US-Behörden).",
          "Weitere Informationen: https://privacy.microsoft.com/de-de/privacystatement"
        ]
      }
    },
    "en": {
      "registration": {
        "summary": "I consent to my voice and image being recorded in Microsoft Teams for later viewing by participants of the selected online group courses.",
        "notice": "Regular online group courses and online trial lessons are always recorded in Microsoft Teams. This consent is required for this booking and must be confirmed individually. Online private lessons are exempt.",
        "full": "I consent to my voice and image being recorded in the booked regular online group course or online trial lesson using Microsoft Teams. The recording is for participants of the same course to review later. This consent is required for this booking; online private lessons are exempt. I can withdraw consent for the future at any time by contacting info@sitov-academy.com or my teacher."
      },
      "monthly": {
        "summary": "I consent to my voice and image being recorded in Microsoft Teams for later viewing by participants of the selected online group courses.",
        "notice": "Regular online group courses and online trial lessons are always recorded in Microsoft Teams. This consent is required for this booking and must be confirmed individually. Online private lessons are exempt.",
        "withdrawal": "You can withdraw consent for the future at any time by contacting info@sitov-academy.com or your teacher."
      },
      "privacy": {
        "title": "9. Video Conferencing Tools and Lesson Recordings (Microsoft Teams)",
        "content": [
          "We use Microsoft Teams for online teaching. Regular online group courses and online trial lessons are always recorded for later viewing by participants of the same course. Online private lessons are exempt from this recording rule.",
          "Provider: Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Ireland (parent company: Microsoft Corporation, USA).",
          "9.1 Type and Purpose of Processing",
          "When using Microsoft Teams, various types of data are processed. The scope of data also depends on the information you provide before or during participation in an online session.",
          "Processed data: Meeting metadata (e.g. date, time, meeting ID), audio and video data (your voice and image), text inputs (chat function) as well as video recordings of the teaching sessions.",
          "Purpose of recording: The recordings serve exclusively the participants of the respective course for review and revision of the learning content.",
          "9.2 Legal Basis",
          "The use of Microsoft Teams for the general delivery of instruction is based on Art. 6 Para. 1 lit. b GDPR (performance of contract).",
          "For recording your voice and image, we obtain separate explicit consent at registration under Article 6(1)(a) GDPR. Registration for regular online group courses and online trial lessons requires this consent. The checkbox starts unchecked and must be confirmed individually; confirming the other required points does not select it. Online private lessons are exempt.",
          "9.3 Storage Duration and Access",
          "The video recordings are stored in a protected environment (e.g. password-protected cloud storage from Microsoft). Access is strictly limited to the instructor and the registered participants of the same course. No disclosure to third parties takes place.",
          "The recordings are permanently deleted no later than 30 days after the completion of the respective course.",
          "9.4 Withdrawal of Consent",
          "You may withdraw your recording consent at any time for the future by contacting info@sitov-academy.com or your teacher. Tell your teacher before the online session if consent is absent or withdrawn. Before recording, the teacher must check that only people with valid consent are captured; otherwise that recording must not take place.",
          "9.5 Data Transfer to Third Countries (USA)",
          "When using Microsoft Teams, data processing in the USA may occur. The transfer is based on the EU-US Data Privacy Framework (DPF) as well as supplementary Standard Contractual Clauses (SCCs). Microsoft is DPF-certified. Please note the general risks of third-country transfers (theoretical access possibilities by US authorities).",
          "Further information: https://privacy.microsoft.com/de-de/privacystatement"
        ]
      }
    },
    "ru": {
      "registration": {
        "summary": "Я соглашаюсь на запись моего голоса и изображения в Microsoft Teams для последующего просмотра участниками выбранных групповых онлайн-курсов.",
        "notice": "Регулярные групповые онлайн-курсы и пробные онлайн-занятия всегда записываются в Microsoft Teams. Это согласие необходимо для данной записи на занятие и подтверждается отдельно. Индивидуальные онлайн-занятия исключены.",
        "full": "Я соглашаюсь на запись моего голоса и изображения на забронированном регулярном групповом онлайн-курсе или пробном онлайн-занятии в Microsoft Teams. Запись предназначена для последующего повторения участниками того же курса. Это согласие необходимо для данного бронирования; индивидуальные онлайн-занятия исключены. Я могу в любое время отозвать согласие на будущее, написав на info@sitov-academy.com или сообщив преподавателю."
      },
      "monthly": {
        "summary": "Я соглашаюсь на запись моего голоса и изображения в Microsoft Teams для последующего просмотра участниками выбранных групповых онлайн-курсов.",
        "notice": "Регулярные групповые онлайн-курсы и пробные онлайн-занятия всегда записываются в Microsoft Teams. Это согласие необходимо для данной записи на занятие и подтверждается отдельно. Индивидуальные онлайн-занятия исключены.",
        "withdrawal": "Вы можете в любое время отозвать согласие на будущее, написав на info@sitov-academy.com или сообщив преподавателю."
      },
      "privacy": {
        "title": "9. Инструменты видеоконференций и записи занятий (Microsoft Teams)",
        "content": [
          "Для онлайн-обучения мы используем Microsoft Teams. Регулярные групповые онлайн-курсы и пробные онлайн-занятия всегда записываются для последующего просмотра участниками того же курса. Индивидуальные онлайн-занятия исключены из этого правила записи.",
          "Провайдер: Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Ирландия (материнская компания: Microsoft Corporation, США).",
          "9.1 Вид и цель обработки",
          "При использовании Microsoft Teams обрабатываются различные виды данных. Объём данных зависит также от того, какие сведения вы предоставляете до или во время участия в онлайн-сессии.",
          "Обрабатываемые данные: Метаданные встречи (напр., дата, время, идентификатор встречи), аудио- и видеоданные (ваш голос и изображение), текстовые вводы (функция чата), а также видеозаписи учебных занятий.",
          "Цель записи: Записи служат исключительно участникам соответствующего курса для повторения и закрепления учебного материала.",
          "9.2 Правовое основание",
          "Использование Microsoft Teams для общего проведения занятий основано на ст. 6 абз. 1 лит. b DSGVO (исполнение договора).",
          "Для записи вашего голоса и изображения при регистрации мы получаем отдельное явное согласие в соответствии со статьёй 6(1)(a) GDPR. Для записи на регулярные групповые онлайн-курсы и пробные онлайн-занятия это согласие необходимо. Флажок изначально снят и подтверждается отдельно; подтверждение других обязательных пунктов его не устанавливает. Индивидуальные онлайн-занятия исключены.",
          "9.3 Срок хранения и доступ",
          "Видеозаписи хранятся в защищённой среде (напр., защищённое паролем облачное хранилище Microsoft). Доступ строго ограничен преподавателем и зарегистрированными участниками того же курса. Передача третьим лицам не осуществляется.",
          "Записи удаляются безвозвратно не позднее 30 дней после завершения соответствующего курса.",
          "9.4 Отзыв согласия",
          "Вы можете в любое время отозвать согласие на запись на будущее, написав на info@sitov-academy.com или сообщив преподавателю. До онлайн-занятия сообщите преподавателю об отсутствии или отзыве согласия. Перед записью преподаватель должен убедиться, что записываются только люди с действительным согласием; иначе такая запись не должна проводиться.",
          "9.5 Передача данных в третьи страны (США)",
          "При использовании Microsoft Teams может происходить обработка данных в США. Передача основана на EU-US Data Privacy Framework (DPF), а также дополнительно на стандартных договорных условиях (SCC). Microsoft сертифицирована по DPF. Пожалуйста, учитывайте общие риски передачи данных в третьи страны (теоретические возможности доступа со стороны властей США).",
          "Дополнительная информация: https://privacy.microsoft.com/de-de/privacystatement"
        ]
      }
    },
    "uk": {
      "registration": {
        "summary": "Я погоджуюся на запис мого голосу й зображення в Microsoft Teams для подальшого перегляду учасниками вибраних групових онлайн-курсів.",
        "notice": "Регулярні групові онлайн-курси й пробні онлайн-заняття завжди записуються в Microsoft Teams. Ця згода є умовою цього бронювання та підтверджується окремо. Індивідуальні онлайн-заняття не підпадають під цю вимогу.",
        "full": "Я погоджуюся на запис мого голосу й зображення на заброньованому регулярному груповому онлайн-курсі або пробному онлайн-занятті в Microsoft Teams. Запис призначений для подальшого повторення учасниками того самого курсу. Ця згода є умовою цього бронювання; індивідуальні онлайн-заняття не підпадають під цю вимогу. Я можу будь-коли відкликати згоду на майбутнє, написавши на info@sitov-academy.com або повідомивши викладача."
      },
      "monthly": {
        "summary": "Я погоджуюся на запис мого голосу й зображення в Microsoft Teams для подальшого перегляду учасниками вибраних групових онлайн-курсів.",
        "notice": "Регулярні групові онлайн-курси й пробні онлайн-заняття завжди записуються в Microsoft Teams. Ця згода є умовою цього бронювання та підтверджується окремо. Індивідуальні онлайн-заняття не підпадають під цю вимогу.",
        "withdrawal": "Ви можете будь-коли відкликати згоду на майбутнє, написавши на info@sitov-academy.com або повідомивши викладача."
      },
      "privacy": {
        "title": "9. Інструменти відеоконференцій та записи занять (Microsoft Teams)",
        "content": [
          "Для онлайн-навчання ми використовуємо Microsoft Teams. Регулярні групові онлайн-курси й пробні онлайн-заняття завжди записуються для подальшого перегляду учасниками того самого курсу. Індивідуальні онлайн-заняття не підпадають під це правило запису.",
          "Провайдер: Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Ірландія (материнська компанія: Microsoft Corporation, США).",
          "9.1 Вид та мета обробки",
          "При використанні Microsoft Teams обробляються різні види даних. Обсяг даних залежить також від того, які відомості ви надаєте до або під час участі в онлайн-сесії.",
          "Оброблювані дані: Метадані зустрічі (напр., дата, час, ідентифікатор зустрічі), аудіо- та відеодані (ваш голос та зображення), текстові введення (функція чату), а також відеозаписи навчальних занять.",
          "Мета запису: Записи призначені виключно для учасників відповідного курсу для повторення та закріплення навчального матеріалу.",
          "9.2 Правова підстава",
          "Використання Microsoft Teams для загального проведення занять базується на ст. 6 абз. 1 літ. b DSGVO (виконання договору).",
          "Для запису вашого голосу й зображення під час реєстрації ми отримуємо окрему явну згоду відповідно до статті 6(1)(a) GDPR. Для реєстрації на регулярні групові онлайн-курси й пробні онлайн-заняття ця згода потрібна. Прапорець спочатку знятий і підтверджується окремо; підтвердження інших обов’язкових пунктів не встановлює його. Індивідуальні онлайн-заняття не підпадають під цю вимогу.",
          "9.3 Термін зберігання та доступ",
          "Відеозаписи зберігаються в захищеному середовищі (напр., захищене паролем хмарне сховище Microsoft). Доступ суворо обмежений викладачем та зареєстрованими учасниками того ж курсу. Передача третім особам не здійснюється.",
          "Записи видаляються безповоротно не пізніше 30 днів після завершення відповідного курсу.",
          "9.4 Відкликання згоди",
          "Ви можете будь-коли відкликати згоду на запис на майбутнє, написавши на info@sitov-academy.com або повідомивши викладача. До онлайн-заняття повідомте викладача про відсутність або відкликання згоди. Перед записом викладач має переконатися, що записуються лише особи з чинною згодою; інакше такий запис не повинен проводитися.",
          "9.5 Передача даних в треті країни (США)",
          "При використанні Microsoft Teams може відбуватися обробка даних в США. Передача базується на EU-US Data Privacy Framework (DPF), а також додатково на стандартних договірних умовах (SCC). Microsoft сертифікована по DPF. Будь ласка, враховуйте загальні ризики передачі даних в треті країни (теоретичні можливості доступу з боку влади США).",
          "Додаткова інформація: https://privacy.microsoft.com/de-de/privacystatement"
        ]
      }
    },
    "tr": {
      "registration": {
        "summary": "Sesimin ve görüntümün, seçilen çevrimiçi grup kurslarının katılımcılarının daha sonra izlemesi için Microsoft Teams üzerinde kaydedilmesine onay veriyorum.",
        "notice": "Düzenli çevrimiçi grup kursları ve çevrimiçi deneme dersleri her zaman Microsoft Teams üzerinde kaydedilir. Bu onay, bu ders kaydı için zorunludur ve ayrı olarak verilmelidir. Çevrimiçi özel dersler bu koşulun dışındadır.",
        "full": "Rezervasyon yaptığım düzenli çevrimiçi grup kursunda veya çevrimiçi deneme dersinde sesimin ve görüntümün Microsoft Teams üzerinde kaydedilmesine onay veriyorum. Kayıt, aynı kursun katılımcılarının daha sonra tekrar yapması içindir. Bu onay bu rezervasyon için zorunludur; çevrimiçi özel dersler bu koşulun dışındadır. Onayımı geleceğe yönelik olarak istediğim zaman info@sitov-academy.com adresine yazarak veya öğretmenime bildirerek geri çekebilirim."
      },
      "monthly": {
        "summary": "Sesimin ve görüntümün, seçilen çevrimiçi grup kurslarının katılımcılarının daha sonra izlemesi için Microsoft Teams üzerinde kaydedilmesine onay veriyorum.",
        "notice": "Düzenli çevrimiçi grup kursları ve çevrimiçi deneme dersleri her zaman Microsoft Teams üzerinde kaydedilir. Bu onay, bu ders kaydı için zorunludur ve ayrı olarak verilmelidir. Çevrimiçi özel dersler bu koşulun dışındadır.",
        "withdrawal": "Onayınızı geleceğe yönelik olarak istediğiniz zaman info@sitov-academy.com adresine yazarak veya öğretmeninize bildirerek geri çekebilirsiniz."
      },
      "privacy": {
        "title": "9. Video Konferans Araçları ve Ders Kayıtları (Microsoft Teams)",
        "content": [
          "Çevrimiçi eğitim için Microsoft Teams kullanıyoruz. Düzenli çevrimiçi grup kursları ve çevrimiçi deneme dersleri, aynı kursun katılımcılarının daha sonra izlemesi için her zaman kaydedilir. Çevrimiçi özel dersler bu kayıt kuralının dışındadır.",
          "Sağlayıcı: Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, İrlanda (ana şirket: Microsoft Corporation, ABD).",
          "9.1 İşlemenin Türü ve Amacı",
          "Microsoft Teams kullanılırken çeşitli veri türleri işlenir. Verilerin kapsamı, çevrimiçi bir oturuma katılmadan önce veya katılım sırasında hangi bilgileri sağladığınıza da bağlıdır.",
          "İşlenen veriler: Toplantı meta verileri (örn. tarih, saat, toplantı kimliği), ses ve video verileri (sesiniz ve görüntünüz), metin girişleri (sohbet işlevi) ve ders oturumlarının video kayıtları.",
          "Kaydın amacı: Kayıtlar, yalnızca ilgili kursun katılımcılarına öğrenme içeriklerini tekrarlama ve pekiştirme amacıyla hizmet eder.",
          "9.2 Yasal Dayanak",
          "Microsoft Teams'in genel ders yürütümü için kullanımı DSGVO Madde 6 Fıkra 1 bent b'ye (sözleşmenin ifası) dayanmaktadır.",
          "Sesinizin ve görüntünüzün kaydı için ders kaydı sırasında GDPR Madde 6(1)(a) uyarınca ayrı ve açık onayınızı alıyoruz. Düzenli çevrimiçi grup kurslarına ve çevrimiçi deneme derslerine kayıt için bu onay gerekir. Onay kutusu başlangıçta işaretli değildir ve ayrı olarak onaylanmalıdır; diğer zorunlu maddeleri onaylamak bu kutuyu işaretlemez. Çevrimiçi özel dersler bu koşulun dışındadır.",
          "9.3 Saklama Süresi ve Erişim",
          "Video kayıtları korumalı bir ortamda (örn. Microsoft'un parola korumalı bulut depolaması) saklanır. Erişim, yalnızca eğitmenle ve aynı kursun kayıtlı katılımcılarıyla sınırlıdır. Üçüncü taraflara ifşa edilmez.",
          "Kayıtlar, ilgili kursun tamamlanmasından en geç 30 gün sonra kalıcı olarak silinir.",
          "9.4 Rızanın Geri Çekilmesi",
          "Kayda ilişkin rızanızı info@sitov-academy.com adresine yazarak veya öğretmene bildirerek geleceğe yönelik olarak her zaman geri alabilirsiniz. Rıza yoksa veya geri alınmışsa çevrimiçi oturumdan önce öğretmene bildirin. Kayıttan önce öğretmen, yalnızca geçerli rızası olan kişilerin kayda alındığını kontrol etmelidir; aksi halde ilgili kayıt yapılmamalıdır.",
          "9.5 Üçüncü Ülkelere Veri Aktarımı (ABD)",
          "Microsoft Teams kullanılırken ABD'de veri işleme gerçekleşebilir. Aktarım, EU-US Data Privacy Framework (DPF) ve ek olarak Standart Sözleşme Maddeleri (SCC'ler) temelinde yapılmaktadır. Microsoft DPF sertifikalıdır. Lütfen üçüncü ülke transferlerinin genel risklerini (ABD makamlarının teorik erişim olasılıkları) dikkate alın.",
          "Daha fazla bilgi: https://privacy.microsoft.com/de-de/privacystatement"
        ]
      }
    }
  }
}$sitov_recording_notice$::jsonb;
BEGIN
 INSERT INTO business_private.sitov_recording_notices(version,payload)
 VALUES('sitov-recording-2026-10-04-v1',frozen_notice) ON CONFLICT(version) DO NOTHING;
 IF (SELECT payload FROM business_private.sitov_recording_notices WHERE version='sitov-recording-2026-10-04-v1') IS DISTINCT FROM frozen_notice THEN
  RAISE EXCEPTION 'Recording notice version already has different immutable text';
 END IF;
END $sitov_notice_snapshot$;

-- Proof is private and append-only for every application/client role. Existing
-- bookings receive no backfill and automatic continuation creates no new proof.
CREATE TABLE IF NOT EXISTS business_private.sitov_recording_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 source text NOT NULL CHECK(source IN('registration','trial','monthly')),
 notice_version text NOT NULL REFERENCES business_private.sitov_recording_notices(version),
 locale text NOT NULL CHECK(locale IN('de','en','ru','uk','tr')),
 course_snapshot jsonb NOT NULL CHECK(jsonb_typeof(course_snapshot)='array' AND jsonb_array_length(course_snapshot)>0)
);
ALTER TABLE business_private.sitov_recording_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_private.sitov_recording_consents FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS sitov_recording_consents_booking_idx ON business_private.sitov_recording_consents(booking_id,granted_at);
CREATE INDEX IF NOT EXISTS sitov_recording_consents_actor_idx ON business_private.sitov_recording_consents(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sitov_recording_consents_notice_idx ON business_private.sitov_recording_consents(notice_version);

-- One bounded row per account: only the current UTC day and at most ten recent
-- successful write times. Invalid requests/transaction rollbacks consume none.
CREATE TABLE IF NOT EXISTS business_private.sitov_recording_monthly_usage (
 actor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 day date NOT NULL,
 day_writes integer NOT NULL DEFAULT 0 CHECK(day_writes BETWEEN 0 AND 40),
 recent_writes timestamptz[] NOT NULL DEFAULT '{}' CHECK(cardinality(recent_writes)<=10),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE business_private.sitov_recording_monthly_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_private.sitov_recording_monthly_usage FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION business_private.sitov_recording_notice_v1() RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT payload FROM business_private.sitov_recording_notices WHERE version='sitov-recording-2026-10-04-v1'
$$;
REVOKE ALL ON FUNCTION business_private.sitov_recording_notice_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION business_private.sitov_record_recording_consent(p_booking_id uuid,p_locale text,p_source text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; actor uuid:=(SELECT auth.uid()); courses jsonb; frozen_notice jsonb;
 usage business_private.sitov_recording_monthly_usage; tick timestamptz; current_day date;
 recent timestamptz[]; writes integer;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
 IF b.id IS NULL OR p_source IS NULL OR p_source NOT IN('registration','trial','monthly') THEN
  RAISE check_violation USING message='invalid_input';
 END IF;
 -- The authenticated monthly writer can attest only to the verified own person.
 -- Anonymous public registrations use the trusted service client and retain NULL.
 IF (p_source='monthly' AND actor IS NULL) OR (actor IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.people WHERE id=b.person_id AND auth_user_id=actor)) THEN
  RAISE insufficient_privilege USING message='not_authorized';
 END IF;
 IF (p_source='trial' AND b.kind<>'trial') OR (p_source='registration' AND b.kind<>'registration')
  OR (p_source='monthly' AND b.kind='trial') THEN
  RAISE check_violation USING message='invalid_input';
 END IF;
 IF b.recording_accepted IS NOT TRUE THEN RETURN; END IF;
 SELECT jsonb_agg(jsonb_build_object('courseId',c.id,'bookingItemId',i.id,
  'title',i.title_snapshot,'type',c.type,'category',c.category) ORDER BY i.course_id,i.id)
 INTO courses FROM public.booking_items i JOIN public.courses c ON c.id=i.course_id
 WHERE i.booking_id=b.id AND c.type='online' AND c.category<>'private';
 IF courses IS NULL THEN RETURN; END IF;
 frozen_notice:=business_private.sitov_recording_notice_v1();
 IF frozen_notice->>'version' IS DISTINCT FROM 'sitov-recording-2026-10-04-v1' THEN
  RAISE check_violation USING message='invalid_input';
 END IF;
 IF p_source='monthly' THEN
  INSERT INTO business_private.sitov_recording_monthly_usage(actor_id,day)
  VALUES(actor,(clock_timestamp() AT TIME ZONE 'UTC')::date) ON CONFLICT(actor_id) DO NOTHING;
  SELECT * INTO STRICT usage FROM business_private.sitov_recording_monthly_usage WHERE actor_id=actor FOR UPDATE;
  -- Re-read wall-clock time after obtaining the per-account lock. Every rival
  -- transaction sees the latest committed tuple under READ COMMITTED.
  tick:=clock_timestamp();current_day:=(tick AT TIME ZONE 'UTC')::date;
  recent:=ARRAY(SELECT moment FROM unnest(usage.recent_writes) moment WHERE moment>tick-interval '10 minutes' ORDER BY moment);
  writes:=CASE WHEN usage.day=current_day THEN usage.day_writes ELSE 0 END;
  IF cardinality(recent)>=10 OR writes>=40 THEN
   RAISE EXCEPTION USING ERRCODE='PT429',MESSAGE='sitov_recording_monthly_limit';
  END IF;
  UPDATE business_private.sitov_recording_monthly_usage SET day=current_day,day_writes=writes+1,
   recent_writes=array_append(recent,tick),updated_at=tick WHERE actor_id=actor;
 END IF;
 INSERT INTO business_private.sitov_recording_consents(booking_id,actor_id,source,notice_version,locale,course_snapshot)
 VALUES(b.id,actor,p_source,'sitov-recording-2026-10-04-v1',
  CASE WHEN p_locale IN('de','en','ru','uk','tr') THEN p_locale ELSE 'de' END,courses);
END $$;
REVOKE ALL ON FUNCTION business_private.sitov_record_recording_consent(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.sitov_record_recording_consent(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_business_registration(p_contact jsonb, p_course_selections jsonb, p_start date, p_consents jsonb, p_locale text DEFAULT 'de'::text, p_trial boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

declare v_person uuid;v_booking uuid;v_email text;v_name text;v_matches integer;
begin
 -- Consent booleans are JSON booleans, never permissively cast strings or numbers.
 -- Missing/null recording stays valid only for presence courses and private lessons.
 IF jsonb_typeof(p_consents) IS DISTINCT FROM 'object'
  OR p_consents->'privacy' IS DISTINCT FROM 'true'::jsonb
  OR p_consents->'agb' IS DISTINCT FROM 'true'::jsonb
  OR (p_consents ? 'revocation' AND jsonb_typeof(p_consents->'revocation') NOT IN('boolean','null'))
  OR (p_consents ? 'recording' AND jsonb_typeof(p_consents->'recording') NOT IN('boolean','null')) THEN
  RAISE check_violation USING message='invalid_input';
 END IF;
 if p_start is null or p_trial is null or p_start<(now() at time zone 'Europe/Berlin')::date or p_start>(now() at time zone 'Europe/Berlin')::date+366 or coalesce((p_consents->>'privacy')::boolean,false)=false or coalesce((p_consents->>'agb')::boolean,false)=false then raise check_violation;end if;
 -- Lock stored course classifications until registration/trial and its items commit.
 -- A caller-supplied category/type can never establish the private/presence exception.
 PERFORM 1 FROM public.courses c
 JOIN business_private.validate_course_selections(p_course_selections,p_start) s ON s.course_id=c.id
 ORDER BY c.id FOR SHARE OF c;
 IF p_consents->'recording' IS DISTINCT FROM 'true'::jsonb AND EXISTS(
  SELECT 1 FROM business_private.validate_course_selections(p_course_selections,p_start) s
  JOIN public.courses c ON c.id=s.course_id WHERE c.type='online' AND c.category<>'private') THEN
  RAISE check_violation USING message='invalid_input';
 END IF;
 if not exists(select 1 from public.locales where code=p_locale) then raise check_violation;end if;
 v_email:=lower(btrim(p_contact->>'email'));v_name:=btrim(p_contact->>'name');
 if v_email is null or length(v_email) not between 3 and 254 or v_name is null or length(v_name) not between 1 and 160 then raise check_violation;end if;
 if p_trial then
  perform pg_advisory_xact_lock(hashtextextended(v_email||':'||lower(v_name),0));
  if exists(select 1 from public.bookings where kind='trial' and lower(contact_email)=v_email and lower(contact_name)=lower(v_name)) then raise unique_violation;end if;
  if jsonb_array_length(p_course_selections)<>1 or not exists(select 1 from public.courses c join public.course_schedules s on s.course_id=c.id
   where c.id=(p_course_selections->0->>'course_id')::uuid and c.category<>'private' and c.trial_lessons and c.archived_at is null and s.weekday=extract(isodow from p_start)
   and (c.start_date is null or p_start>=c.start_date) and (c.end_date is null or p_start<=c.end_date)
   and not exists(select 1 from public.course_exceptions e where e.date=p_start and (e.course_id is null or e.course_id=c.id))) then raise check_violation;end if;
 end if;
 -- Submitted details never update an existing identity. Exact identity reuse
 -- only attaches a pending application, exposing no personal data to the caller.
 perform pg_advisory_xact_lock(hashtextextended('application-person:'||v_email||':'||lower(v_name),0));
 select count(*),(array_agg(id))[1] into v_matches,v_person from public.people where lower(email)=v_email and lower(display_name)=lower(v_name)
 and birth_date is not distinct from (p_contact->>'birth_date')::date;
 if v_matches<>1 then
  insert into public.people(display_name,email,birth_date,phone,street,postal_code,city,preferred_locale)
  values(v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',p_locale) returning id into v_person;
 end if;
 insert into public.bookings(person_id,target_month,start_date,kind,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted,revocation_accepted,recording_accepted)
 values(v_person,date_trunc('month',p_start)::date,p_start,(case when p_trial then 'trial' else 'registration' end)::public.booking_kind,v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',true,true,coalesce((p_consents->>'revocation')::boolean,false),(p_consents->>'recording')::boolean) returning id into v_booking;
 perform business_private.replace_items(v_booking,p_course_selections);
 perform business_private.sitov_record_recording_consent(v_booking,p_locale,case when p_trial then 'trial' else 'registration' end);
 perform platform_private.require_rpc_success(public.queue_transactional_email('registration:'||v_booking,'registration_received',v_email,p_locale,jsonb_build_object('name',v_name,'startDate',p_start,'exceptions',business_private.booking_mail_exceptions(v_booking),'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=v_booking))));
 perform platform_private.require_rpc_success(public.queue_transactional_email('staff-registration:'||v_booking,'new_enrollment','info@sitov-academy.com','de',jsonb_build_object('name',v_name,'path','/de/admin/registrations')));
 RETURN to_jsonb(v_booking);
end;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  -- Preserve stable domain codes, never include arbitrary SQL text or row data.
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','invalid_answer','exercise_unavailable','trainer_access_denied',
   'learning_reset_in_progress','reset_owner_required','confirmation_required','audio_removal_incomplete',
   'inactive_content','invalid_decisions','invalid_decision','invalid_direction','level_access_denied',
   'lesson_not_found','invalid_language','answer_too_long','progress_not_found','review_not_due',
   'vocabulary_spacing_required','sentence_content_missing','answer_required','invalid_answer_request',
   'invalid_learning_language','vocabulary_request_conflict','unknown_course_audience',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found',
   'email_unverified','identity_conflict','identity_already_linked','person_not_found','auth_user_not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  WHEN boundary_state='22008' THEN 'month_changed'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='vocabulary_spacing_required' THEN 'Review another card before this card.'
   WHEN boundary_code='review_not_due' THEN 'This review is not due yet.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean) TO service_role;


-- Fork the current owner/confirmation/optimistic-lock logic, including migration
-- 68, rather than replace it with a stale earlier save_month implementation.
DO $sitov_recording_month$
DECLARE definition text; previous text; replacement text;
BEGIN
 IF to_regprocedure('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text)') IS NOT NULL THEN
  definition:=pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text)'::regprocedure);
  IF strpos(definition,'sitov-month-recording-consent-v1')=0
   OR strpos(definition,'sitov_confirmed_registration_required')=0
   OR strpos(definition,'sitov-month-recording-locale-v1')=0 THEN
   RAISE EXCEPTION 'Unexpected existing seven-argument save_month; no unsafe replacement';
  END IF;
 ELSIF to_regprocedure('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)') IS NULL THEN
  definition:=pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer)'::regprocedure);
  IF strpos(definition,'sitov_confirmed_registration_required')=0 THEN
   RAISE EXCEPTION 'Required confirmed-registration guard is missing; apply migration 68 first';
  END IF;
  previous:='p_revision integer)';
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month signature'; END IF;
  definition:=replace(definition,previous,'p_revision integer, p_recording_accepted boolean)');
  previous:=' select * into b from public.bookings where person_id=p.id and target_month=p_month and kind<>''trial'' for update;';
  replacement:=$code$
 -- sitov-month-recording-consent-v1: verify persisted classes before any booking mutation.
 IF NOT p_paused THEN
  PERFORM 1 FROM public.courses c
  JOIN business_private.validate_course_selections(p_course_selections,p_month) s ON s.course_id=c.id
  ORDER BY c.id FOR SHARE OF c;
  IF p_recording_accepted IS NOT TRUE AND EXISTS(
   SELECT 1 FROM business_private.validate_course_selections(p_course_selections,p_month) s
   JOIN public.courses c ON c.id=s.course_id WHERE c.type='online' AND c.category<>'private') THEN
   RAISE check_violation USING message='invalid_input';
  END IF;
 END IF;
$code$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month booking lock'; END IF;
  definition:=replace(definition,previous,replacement||previous);
  previous:='contact_city,privacy_accepted,agb_accepted)';
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month consent columns'; END IF;
  definition:=replace(definition,previous,'contact_city,privacy_accepted,agb_accepted,recording_accepted)');
  previous:='p.city,true,true) returning * into b;';
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month consent values'; END IF;
  definition:=replace(definition,previous,'p.city,true,true,p_recording_accepted) returning * into b;');
  previous:='update public.bookings set status=(case when p_paused then ''cancelled'' else ''pending'' end)::public.booking_status,updated_at=now(),revision=revision+1 where id=b.id;';
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month update'; END IF;
  definition:=replace(definition,previous,'update public.bookings set status=(case when p_paused then ''cancelled'' else ''pending'' end)::public.booking_status,recording_accepted=case when p_paused then recording_accepted else p_recording_accepted end,updated_at=now(),revision=revision+1 where id=b.id;');
  EXECUTE definition;
 ELSE
  definition:=pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)'::regprocedure);
  IF strpos(definition,'sitov-month-recording-consent-v1')=0
   OR strpos(definition,'sitov_confirmed_registration_required')=0 THEN
   RAISE EXCEPTION 'Unexpected existing six-argument save_month; no unsafe replacement';
  END IF;
 END IF;
END $sitov_recording_month$;
REVOKE ALL ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer,boolean) TO authenticated,service_role;


-- Replaying the completed migration changes no proof row. This patch also
-- upgrades an already guarded preliminary 84 six-argument function safely.
DO $sitov_recording_month_proof$
DECLARE definition text; previous text; replacement text;
BEGIN
 IF to_regprocedure('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text)') IS NULL THEN
 definition:=pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)'::regprocedure);
 IF strpos(definition,'sitov-month-recording-proof-v1')=0 THEN
  previous:=' return b.id;';
  replacement:=$code$
 -- sitov-month-recording-proof-v1: a fresh student write, never automatic renewal.
 IF NOT p_paused THEN
  PERFORM business_private.sitov_record_recording_consent(b.id,
   COALESCE((SELECT pr.ui_language FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()) AND pr.ui_language IN('de','en','ru','uk','tr')),
    (SELECT m.locale FROM private.mail_outbox m WHERE m.dedupe_key='registration:'||b.id AND m.locale IN('de','en','ru','uk','tr')),'de'),
   'monthly');
 END IF;
$code$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected six-argument save_month return'; END IF;
  definition:=replace(definition,previous,replacement||previous);
  EXECUTE definition;
 END IF;
 END IF;
END $sitov_recording_month_proof$;


-- Explicit route language records the shown notice. Optional NULL retains the
-- old profile/registration-mail fallback for existing callers. No session GUC.
DO $sitov_recording_month_locale$
DECLARE definition text; previous text; replacement text;
BEGIN
 IF to_regprocedure('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text)') IS NULL THEN
  definition:=pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)'::regprocedure);
  IF strpos(definition,'sitov-month-recording-proof-v1')=0 OR strpos(definition,'sitov_confirmed_registration_required')=0 THEN
   RAISE EXCEPTION 'Required six-argument save_month protection is missing';
  END IF;
  previous:='p_recording_accepted boolean)';
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected recording save_month signature'; END IF;
  definition:=replace(definition,previous,'p_recording_accepted boolean, p_locale text)');
  previous:=' IF business_private.claim_person() ? ''error'' THEN';
  replacement:=$code$
 -- sitov-month-recording-locale-v1
 IF p_locale IS NOT NULL AND p_locale NOT IN('de','en','ru','uk','tr') THEN
  RAISE check_violation USING message='invalid_input';
 END IF;
$code$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month owner check'; END IF;
  definition:=replace(definition,previous,replacement||previous);
  previous:='COALESCE((SELECT pr.ui_language FROM public.profiles pr';
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected save_month proof locale'; END IF;
  definition:=replace(definition,previous,'COALESCE(p_locale,(SELECT pr.ui_language FROM public.profiles pr');
  EXECUTE definition;
 END IF;
END $sitov_recording_month_locale$;
REVOKE ALL ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION business_private.save_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid,p_revision integer,p_recording_accepted boolean) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision,p_recording_accepted,NULL)
$$;
REVOKE ALL ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer,boolean) TO authenticated,service_role;

-- Old clients and direct legacy REST calls cannot bypass the new requirement.
-- NULL remains allowed for a pause, presence course or private lesson.
CREATE OR REPLACE FUNCTION business_private.save_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid,p_revision integer) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision,NULL)
$$;
REVOKE ALL ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.save_month(date,jsonb,boolean,uuid,integer) TO authenticated,service_role;

-- Only the seven-argument public signature exists. Old six-field JSON and SQL
-- calls resolve its NULL default without ambiguous PostgREST overloads.
DROP FUNCTION IF EXISTS public.sitov_save_business_month(date,jsonb,boolean,uuid,integer,boolean) RESTRICT;
CREATE OR REPLACE FUNCTION public.sitov_save_business_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid DEFAULT NULL::uuid, p_revision integer DEFAULT NULL::integer, p_recording_accepted boolean DEFAULT NULL::boolean, p_locale text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((select business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision,p_recording_accepted,p_locale)));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  -- Preserve stable domain codes, never include arbitrary SQL text or row data.
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','invalid_answer','exercise_unavailable','trainer_access_denied',
   'learning_reset_in_progress','reset_owner_required','confirmation_required','audio_removal_incomplete',
   'inactive_content','invalid_decisions','invalid_decision','invalid_direction','level_access_denied',
   'lesson_not_found','invalid_language','answer_too_long','progress_not_found','review_not_due',
   'vocabulary_spacing_required','sentence_content_missing','answer_required','invalid_answer_request',
   'invalid_learning_language','vocabulary_request_conflict','unknown_course_audience',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found',
   'email_unverified','identity_conflict','identity_already_linked','person_not_found','auth_user_not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  WHEN boundary_state='22008' THEN 'month_changed'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='vocabulary_spacing_required' THEN 'Review another card before this card.'
   WHEN boundary_code='review_not_due' THEN 'This review is not due yet.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END;
$$;
REVOKE ALL ON FUNCTION public.sitov_save_business_month(date,jsonb,boolean,uuid,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_save_business_month(date,jsonb,boolean,uuid,integer,boolean,text) TO authenticated,service_role;

-- Staff continuation preserves inherited true consent. A historical refused or
-- absent choice never becomes inferred consent or aborts other students' month.
DO $sitov_recording_continuation$
DECLARE definition text; previous text; replacement text;
BEGIN
 definition:=pg_get_functiondef('business_private.prepare_month(date)'::regprocedure);
 IF strpos(definition,'sitov-month-recording-continuation-v1')=0 THEN
  previous:='  if selections is null then continue;end if;';
  replacement:=$code$
  -- sitov-month-recording-continuation-v1
  PERFORM 1 FROM public.courses c
  JOIN business_private.validate_course_selections(selections,p_month) s ON s.course_id=c.id
  ORDER BY c.id FOR SHARE OF c;
  IF previous.recording_accepted IS NOT TRUE AND EXISTS(
   SELECT 1 FROM business_private.validate_course_selections(selections,p_month) s
   JOIN public.courses c ON c.id=s.course_id WHERE c.type='online' AND c.category<>'private') THEN
   CONTINUE;
  END IF;
$code$;
  IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unexpected prepare_month selection check'; END IF;
  definition:=replace(definition,previous,previous||replacement);
  EXECUTE definition;
 END IF;
END $sitov_recording_continuation$;

-- Correct only the exact legacy phrase introduced by migration 82. Preserve
-- every course identifier, other description text and historical consent value.
UPDATE public.courses SET description=replace(description,
 'Unterrichtsaufzeichnungen zur Wiederholung sind nur mit freiwilliger Einwilligung aller erfassten Personen möglich. Die Anmeldung ist auch ohne Aufnahmeeinwilligung möglich.',
 'Reguläre Online-Gruppenkurse und Online-Probestunden werden in Microsoft Teams immer aufgezeichnet, damit die Schüler sie später ansehen können. Die Einwilligung ist Voraussetzung für diese Buchung. Online-Privatunterricht ist davon ausgenommen.')
WHERE slug IN('deutsch-b1-online','deutsch-a1-1-online')
 AND type='online' AND category<>'private'
 AND strpos(description,'Unterrichtsaufzeichnungen zur Wiederholung sind nur mit freiwilliger Einwilligung aller erfassten Personen möglich. Die Anmeldung ist auch ohne Aufnahmeeinwilligung möglich.')>0;

NOTIFY pgrst,'reload schema';
