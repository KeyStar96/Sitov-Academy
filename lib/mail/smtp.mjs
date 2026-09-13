import nodemailer from 'nodemailer'

/** Native worker must use this machine's Postfix listener, never an external API. */
export function createLocalSmtpTransport(env = process.env) {
  const host = env.SMTP_HOST || '127.0.0.1'
  if (!['127.0.0.1','localhost','::1'].includes(host)) throw new Error('smtp_must_use_local_postfix')
  const port = Number(env.SMTP_PORT || '25')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_smtp_port')
  return nodemailer.createTransport({ host, port, secure:false, ignoreTLS:true,
    connectionTimeout:10000, greetingTimeout:10000, socketTimeout:20000,
    disableFileAccess:true, disableUrlAccess:true })
}
export function senderAddress(env = process.env) {
  const configured = env.SMTP_FROM || env.SMTP_SENDER || 'info@sitov-academy.com'
  const address = configured.match(/<([^<>]+)>/)?.[1] || configured
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(address)) throw new Error('invalid_smtp_sender')
  return { name:'Sitov Academy', address }
}
export function deliveryError(error) {
  const code = typeof error?.code === 'string' ? error.code.replace(/[^A-Z0-9_]/gi,'').slice(0,40) : 'MAIL_ERROR'
  const responseCode = Number(error?.responseCode) || 0
  return { code:`${code}${responseCode ? `_${responseCode}` : ''}`, permanent:responseCode >= 500 && responseCode < 600 }
}
