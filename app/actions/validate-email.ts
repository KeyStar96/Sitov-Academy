"use server";

import dns from "dns";
import util from "util";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/ratelimit";

const resolveMx = util.promisify(dns.resolveMx);

/**
 * DNS-Codes, die eine endgültige Aussage über die Domain treffen: Es gibt
 * nachweislich keinen Mailserver. Jeder andere Code (ESERVFAIL, ETIMEOUT,
 * ECONNREFUSED, …) bedeutet nur, dass der Resolver gerade nicht antwortet —
 * das ist eine Störung auf unserer Seite und darf keine Adresse ablehnen.
 */
const DOMAIN_HAS_NO_MAILSERVER = new Set(["ENOTFOUND", "ENODATA", "EBADNAME"]);

/**
 * Diese Action ist bewusst OHNE Auth-Prüfung: Sie validiert die Adresse in der
 * öffentlichen Registrierung und Kündigung (lib/registration-schema.ts,
 * lib/cancellation-schema.ts), also bevor ein Konto existiert. Eine
 * Anmeldepflicht würde genau den Ablauf zerstören, den sie absichert.
 *
 * Der Schutz ist deshalb ein Rate-Limit pro Absender-IP. Es begrenzt die
 * DNS-Last, die ein anonymer Aufrufer über den loopback-gebundenen Resolver
 * erzeugen kann (R3: ausgehende Verbindungen sind kernelseitig gesperrt).
 * Wird das Limit erreicht, überspringen wir die MX-Prüfung, statt die
 * Registrierung zu blockieren: Die MX-Abfrage ist Komfort, keine
 * Sicherheitskontrolle. Der echte Missbrauchsschutz sitzt in den
 * Absende-Actions (submit-enrollment/-trial/-cancellation, je 3 pro Stunde).
 */
export async function validateEmail(email: string): Promise<{ isValid: boolean; reason?: string }> {
    try {
        const domain = email.split("@")[1];
        if (!domain) return { isValid: false, reason: "missing_domain" };

        const ip = await getClientIp();
        if (!(await rateLimit(`email-mx:${ip}`, 30, '5 m')).success) {
            // Fail-open mit Begründung: lieber eine ungeprüfte Adresse annehmen
            // (sie bounct später) als einen echten Interessenten aussperren.
            console.error("[validate-email] mx_check_skipped reason=rate_limited");
            return { isValid: true, reason: "mx_check_skipped" };
        }

        // 1. Check MX Records (Primary)
        try {
            const mxAddresses = await resolveMx(domain);
            if (mxAddresses && mxAddresses.length > 0) return { isValid: true };
            // Leere Antwort = Domain existiert, hat aber keinen Mailserver.
            return { isValid: false, reason: "no_mx_record" };
        } catch (error) {
            // R10: Der frühere leere catch machte aus einem Resolver-Ausfall ein
            // "ungültige Adresse" und blockierte damit Registrierung UND
            // Kündigung, solange DNS gestört war. Beide Fälle sind jetzt getrennt.
            const code = (error as NodeJS.ErrnoException)?.code ?? "UNKNOWN";
            if (DOMAIN_HAS_NO_MAILSERVER.has(code)) {
                return { isValid: false, reason: "no_mx_record" };
            }
            console.error("[validate-email] mx_lookup_unavailable");
            return { isValid: true, reason: "mx_lookup_unavailable" };
        }
    } catch (error) {
        // Unerwarteter Fehler vor der MX-Abfrage (z. B. Rate-Limiter-Store weg).
        // Auch hier fail-open, damit eine Störung niemanden aussperrt.
        console.error("[validate-email] validation_unavailable");
        return { isValid: true, reason: "validation_unavailable" };
    }
}
