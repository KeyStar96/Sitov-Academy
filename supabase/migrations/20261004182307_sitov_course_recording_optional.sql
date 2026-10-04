-- Replace the two legacy unconditional recording promises without changing course identifiers or bookings.
UPDATE public.courses
SET description = replace(description,
 'inklusive Unterrichtsaufzeichnung für die eigene Wiederholung im Anschluss und intensivem 24/7 Telegram-Support',
 'mit intensivem 24/7 Telegram-Support')
 || ' Unterrichtsaufzeichnungen zur Wiederholung sind nur mit freiwilliger Einwilligung aller erfassten Personen möglich. Die Anmeldung ist auch ohne Aufnahmeeinwilligung möglich.'
WHERE slug IN ('deutsch-b1-online','deutsch-a1-1-online')
 AND strpos(description,'inklusive Unterrichtsaufzeichnung für die eigene Wiederholung im Anschluss und intensivem 24/7 Telegram-Support') > 0;
