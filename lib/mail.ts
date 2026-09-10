import 'server-only'

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

export interface MailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export interface MailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Creates and returns a cached or new Nodemailer SMTP Transporter.
 * Guarded with 'server-only' to prevent any accidental leakage to client bundles.
 */
function createSmtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST
  if (!host) {
    return null
  }

  const port = Number(process.env.SMTP_PORT) || 587
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })
}

/**
 * Sends an email using SMTP transport.
 * Strictly server-side execution.
 */
export async function sendEmail(options: MailOptions): Promise<MailSendResult> {
  try {
    const transporter = createSmtpTransporter()
    if (!transporter) {
      return { success: false, error: 'smtp_not_configured' }
    }

    const defaultFrom =
      process.env.SMTP_FROM ||
      (process.env.SMTP_USER ? `"Sitov Academy" <${process.env.SMTP_USER}>` : '"Sitov Academy" <info@sitov-academy.com>')

    const fromAddress = options.from || defaultFrom
    const formattedFrom =
      fromAddress.includes('<') && fromAddress.includes('>')
        ? fromAddress
        : `"Sitov Academy" <${fromAddress}>`

    const info = await transporter.sendMail({
      from: formattedFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    return { success: true, messageId: info.messageId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[SMTP Mailer] Failed to send email:', errorMsg)
    return { success: false, error: errorMsg }
  }
}
