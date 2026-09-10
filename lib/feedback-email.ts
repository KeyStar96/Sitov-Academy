import { CANONICAL_SITE_URL, normalizeOrigin } from './site-url'

export interface FeedbackNotificationEmailInput {
  studentName: string
  feedbackUrl: string
  siteUrl: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

/** Table layout and inline styles also work in mail clients without CSS support. */
export function renderFeedbackNotificationEmail(input: FeedbackNotificationEmailInput): string {
  const siteUrl = normalizeOrigin(input.siteUrl) ?? CANONICAL_SITE_URL
  const feedbackUrl = new URL(input.feedbackUrl)
  if (!['https:', 'http:'].includes(feedbackUrl.protocol) || feedbackUrl.username || feedbackUrl.password) {
    throw new Error('Invalid feedback email URL')
  }
  const name = escapeHtml(input.studentName)
  const link = escapeHtml(feedbackUrl.href)
  const origin = escapeHtml(siteUrl)

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dein Feedback ist da · Sitov Academy</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f5ef;font-family:Arial,Helvetica,sans-serif;color:#24272b;">
    <div style="display:none;max-height:0;overflow:hidden;">Deine Lehrkraft hat dir eine Rückmeldung zu deiner Sprachaufnahme hinterlegt.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f5ef;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffefa;border-radius:24px;padding:32px 24px;">
          <tr><td align="center" style="padding-bottom:28px;">
            <img src="${origin}/Bilder/favicon.png" alt="" width="56" height="56" style="display:block;width:56px;height:56px;margin:0 auto 12px;" />
            <div style="font-size:26px;line-height:1.2;font-weight:bold;color:#24272b;">Sitov Academy</div>
          </td></tr>
          <tr><td style="font-size:18px;line-height:1.6;">
            <p style="font-size:14px;letter-spacing:1px;color:#626762;margin:0 0 12px;">DEIN LERNRAUM</p>
            <h1 style="font-size:28px;line-height:1.25;margin:0 0 24px;">Dein Feedback ist da.</h1>
            <p style="margin:0 0 16px;">Hallo ${name},</p>
            <p style="margin:0 0 16px;">Deine Lehrkraft hat dir eine Rückmeldung zu deiner Sprachaufnahme hinterlegt.</p>
            <p style="margin:0 0 24px;">Du kannst sie dir jetzt in Ruhe anhören.</p>
            <p style="margin:0 0 28px;">
              <a href="${link}" style="display:inline-block;min-height:48px;line-height:48px;padding:0 28px;background:#bd3510;color:#fffefa;text-decoration:none;border-radius:999px;font-size:18px;font-weight:bold;">Feedback anhören</a>
            </p>
            <p style="font-size:16px;line-height:1.6;color:#626762;margin:0 0 8px;">Falls der Button nicht funktioniert, öffne diesen Link in deinem Browser:</p>
            <p style="font-size:14px;line-height:1.6;word-break:break-all;margin:0;"><a href="${link}" style="color:#626762;">${link}</a></p>
          </td></tr>
        </table>
        <p style="max-width:600px;font-size:14px;line-height:1.7;color:#626762;margin:24px 0 0;">
          Sitov Academy<br />
          Sitz der Sprachschule: Hüttenstraße 24a · 30165 Hannover<br />
          <a href="mailto:info@sitov-academy.com" style="color:#626762;">info@sitov-academy.com</a> · <a href="tel:+491714758620" style="color:#626762;">+49 171 4758620</a><br />
          <a href="${origin}/de/imprint" style="color:#626762;">Impressum</a> · <a href="${origin}/de/privacy" style="color:#626762;">Datenschutz</a> · <a href="${origin}/de/agb" style="color:#626762;">AGB</a>
        </p>
      </td></tr>
    </table>
  </body>
</html>`
}
