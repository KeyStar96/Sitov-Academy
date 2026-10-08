import 'server-only'

export interface SitovCheckoutRequest {
  orderId: string
  accountId: string
  amountMinor: number
  currency: string
  requestId: string
}
export type SitovCheckoutResponse = { ok: false; error: 'provider_not_configured' }
/** No success variant until a verified provider implementation is separately authorized. */
export interface SitovPaymentProvider {
  readonly id: 'none'
  readonly configured: false
  startCheckout(request: SitovCheckoutRequest): Promise<SitovCheckoutResponse>
}
export const sitovDisabledPaymentProvider: SitovPaymentProvider = Object.freeze({
  id: 'none',
  configured: false,
  async startCheckout() { return { ok: false, error: 'provider_not_configured' } as const },
})
